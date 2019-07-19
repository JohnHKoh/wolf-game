$(function(){

    var socket = io();
    var curUser;
    var curCode;
    var roles = {
        "Villagers":"Villager",
        "Werewolves": "Werewolf",
        "Tanners":"Tanner",
        "Seers":"Seer"
    };


    if (window.location.pathname !== "/" &&
        window.location.pathname !== "/help" &&
        window.location.pathname !== "/about") {
        if (window.location.pathname.substr(1).match(/^[A-z0-9]{4}$/)) {
            let code = window.location.pathname.substr(1);
            curCode = code;
            socket.emit('codeLinkFollowed', code);
        }
        else {
            window.location.pathname = "/";
        }
    }

    socket.on('startMain', function() {
        $("#main").delay(250).fadeIn(1000);

    });

    function blink_text() {
        $('.blink').fadeOut(500);
        $('.blink').fadeIn(500);
    }
    setInterval(blink_text, 2500);

    Object.keys(roles).forEach(function(role) {
        $("#roleGroups").append(
            '<div class="form-group row">\n' +
            '                        <label class="col-5 col-form-label">' + role + '</label>\n' +
            '                        <div class="col-7">\n' +
            '                            <div class="input-group">\n' +
            '                                <span class="input-group-btn">\n' +
            '                                    <button type="button" class="btn btn-default btn-number" disabled="disabled" data-type="minus" data-field="' + role + 'Count">\n' +
            '                                    <span class="fa fa-minus"></span>\n' +
            '                                    </button>\n' +
            '                                </span>\n' +
            '                                <input type="text" name="' + role + 'Count" class="form-control input-number text-center" value="0" data-set="totalCount">\n' +
            '                                <span class="input-group-btn">\n' +
            '                                    <button type="button" class="btn btn-default btn-number" data-type="plus" data-field="' + role + 'Count">\n' +
            '                                    <span class="fa fa-plus"></span>\n' +
            '                                    </button>\n' +
            '                                </span>\n' +
            '                            </div>\n' +
            '                        </div>\n' +
            '                    </div>'
        )
    });


    $("#createRoom, #joinRoom").on("click", function()
    {
        // Don't do anything when some element is in the collapsing transition.
        if ($(".collapsing").length > 0) return;

        let toggled = $(":button.active");
        $(this).button('toggle');

        let target = $(this).data('target');
        let others = $(":visible.collapse.show:not(" + target + ")");


        if (others.length > 0)
        {
            $(toggled).button('toggle');
            others.collapse("hide").one("hidden.bs.collapse", function()
            {
                $(target).collapse("show");
            });
        }
        else
        {
            $(target).collapse('toggle');
        }
    });

    $("#createForm").on("submit", function(e) {
        e.preventDefault();
        $("form#joinForm :input").each(function() {
            $(this).removeClass("is-invalid");
        });
        var name = $("#name").val();
        if (name === "") {
            $("#name").addClass("is-invalid");
        }
        else {
            $("#name").removeClass("is-invalid");
        }
        if ($(".is-invalid").length > 0) return;
        socket.emit('createRoom', name);
    });

    $("#joinForm").on("submit", function(e) {
        e.preventDefault();
        $("form#createForm :input").each(function() {
            $(this).removeClass("is-invalid");
        });
        let name = $("#name2");
        let code = $("#code");
        if (name.val() === "") {
            $("#nameFeedback").text('Please choose a name.');
            name.addClass("is-invalid");
        }
        else {
            name.removeClass("is-invalid");
        }
        if (code.val().length < 4) {
            $("#codeFeedback").text('Invalid room code.');
            code.addClass("is-invalid");
        }
        else {
            code.removeClass("is-invalid");
        }
        if ($(".is-invalid").length > 0) return;
        name = name.val();
        code = code.val();
        socket.emit('joinRoom', code, name);
    });

    $("#leave").on("click", function() {
        $("#game").fadeOut(1000, function() {
            socket.emit('leaveRoom');
            window.location.pathname = "/";
        });
    });

    $("#end").on("click", function() {
        socket.emit('endGame', curCode);
    });

    $('.btn-number').on("click", function(e){
        e.preventDefault();

        let fieldName = $(this).attr('data-field');
        let type      = $(this).attr('data-type');
        let input = $("input[name='"+fieldName+"']");
        let roleCounts = 0;
        $("input[data-set='totalCount']").each(function() {
            roleCounts += parseInt($(this).val(), 10);
        });
        let currentVal = parseInt(input.val(), 10);
        let roleCount = $('#roleCount');
        if (!isNaN(currentVal)) {
            if(type === 'minus') {

                if(currentVal > 0) {
                    input.val(currentVal - 1).trigger('change');
                    roleCount.val(roleCounts - 1).trigger('change');
                }
                if(parseInt(input.val()) === 0) {
                    $(this).prop('disabled', true);
                }

            } else if(type === 'plus') {
                input.val(currentVal + 1).trigger('change');
                roleCount.val(roleCounts + 1).trigger('change');
            }
        } else {
            input.val(0);
        }

    });

    $('.input-number').on('change', function() {
        let valueCurrent = parseInt($(this).val(), 10);

        let name = $(this).attr('name');
        if(valueCurrent >= 0) {
            $(".btn-number[data-type='minus'][data-field='"+name+"']").removeAttr('disabled')
        }
    });
    $(".input-number").on('keydown', function (e) {
        e.preventDefault();
    });
    $('#roleCount').on('change', function() {
        let color = 'black';
        let roleCount = parseInt($(this).val(), 10);
        let playerCount = parseInt($('#playerCount').val(), 10);
        if (roleCount > playerCount + 3) {
            color = 'red';
        }
        if (roleCount !== playerCount + 3) {
            $('#startGame').prop('disabled', true);
            $("#startGame").attr('title', 'Role count must be exactly three more than player count.');
        }
        else {
            $('#startGame').prop('disabled', false);
            $("#startGame").removeAttr('title');
        }
        $('#roleLabel, #roleCount').css('color', color);
    });

    $("#startGame").on("click", function() {
        var form = $("#collapseForm");
        form.collapse("hide");
        var values = {};
        $.each($('.input-number').serializeArray(), function(i, field) {
            values[field.name] = field.value;
        });
        socket.emit('startGame', curCode);
        socket.emit('assignRoles', values, curCode);

    });

    $(document).on("click", "[id*='hidden']", function() {
        $($(this).data('target')).toggleClass("imgGlow");
    });

    $(document).on("click", "#showRole", function() {
        $("#role").toggleClass('invisible');
    });

    socket.on('rolesChosen', function() {
        var txt = $("#choosing");
        txt.removeClass('blink');
        txt.finish();
        txt.text('Roles chosen!');
        txt.css({'color': 'white'});
    });

    socket.on('newJoiner', function(code) {
        $("#main").delay(250).fadeIn(1000);
        $("#joinRoom").trigger("click");
        $("#code").val(code);
    });

    socket.on('roomJoined', function(code, name, host, started) {
        history.pushState(null, null, code);
        curUser = name;
        curCode = code;
        if (started) {
            $("#roomCode").text(code);
            $("#main").css('display', 'none');
            $("#collapseForm").removeClass('show');
            socket.emit('getRoles', code);
            $("#game").fadeIn(1000);
        }
        else {
            $("#main").fadeOut(1000, function() {
                $('#choosing').addClass('blink');
                $("#roomCode").text(code);
                if (name !== host) $("#collapseForm").removeClass('show');
                $("#game").fadeIn(1000);
            });
        }

    });

    socket.on('updateUsers', function(room, started) {
        var list = $('#users');
        $('#playerCount').val(room.users.length);
        $('#roleCount').trigger('change');
        list.empty();
        room.users.forEach(function(user) {
            var item = $('<li class="list-group-item">');
            item.text(user);
            if (user === curUser) {
                item.append($('<span>').css('color', 'grey').text(' (You)'));
            }
            if (user === room.host) {
                item.prepend('<i class="fa fa-crown">&nbsp;');
            }
            list.append(item);
        });
        if (curUser === room.host) {
            var form = $("#collapseForm");
            if (!started) form.collapse('show');
        }
    });

    socket.on('nameTaken', function() {
        $("#nameFeedback").text('Name is already in use.');
        $("#name2").addClass("is-invalid");
    });

    socket.on('noSuchRoom', function() {
        if (!$("#main").is(':visible')) {
            $("#main").delay(250).fadeIn(1000);
            $("#joinRoom").trigger("click");
        }
        $("#codeFeedback").text('Room does not exist.');
        $("#code").addClass("is-invalid");
        $("#code").val(curCode);
    });

    socket.on('gameAlreadyStarted', function() {
        $("#codeFeedback").text('This game has already begun.');
        $("#code").addClass("is-invalid");
    });

    socket.on('alreadyInRoom', function() {
        if (!$("#main").is(':visible')) {
            $("#main").delay(250).fadeIn(1000);
            $("#joinRoom").trigger("click");
        }
        $("#createNameFeedback").text("You are already in a game. Please leave the game before joining a new one.");
        $("#codeFeedback").text("You are already in a game. Please leave the game before joining a new one.");
        $("#code").addClass("is-invalid");
        $('#name').addClass("is-invalid");
    });


    socket.on('displayRoles', function(usersAndRoles, middleRoles, host, anim) {
        var txt = $("#choosing");
        var role = $("#role");
        var group = $("#choosingGroup");
        if (anim) {
            setTimeout(function() {
                txt.text(curUser + ', you are a ');
                role.text(roles[usersAndRoles[curUser]]);
                group.append('<i id="showRole" class="fas fa-eye"></i>');
                txt.removeClass('blink');
                txt.css({"color":"white", "display": "none"});
                txt.fadeIn(1000);
                setTimeout(function() {
                    var cards = $("#middleCards");
                    var hidden = $("[id*='hidden']");
                    hidden.css('display', 'flex');
                    showPlayerCards(usersAndRoles);
                    cards.collapse('show');
                    cards.on('shown.bs.collapse', function() {
                        hidden.fadeIn(1200);
                        if (curUser === host) $('#endButton').fadeIn();
                    });


                }, 1000);

            }, 1500)
        }
        else {
            txt.text(curUser + ', you are a ');
            role.text(roles[usersAndRoles[curUser]]);
            group.append('<i id="showRole" class="fas fa-eye"></i>');
            txt.removeClass('blink');
            txt.css({"color":"white"});
            var cards = $("#middleCards");
            var hidden = $("[id*='hidden']");
            hidden.css('display', 'flex');
            showPlayerCards(usersAndRoles);
            cards.addClass('show');
            hidden.fadeIn(1200);
            if (curUser === host) $('#endButton').css('display', 'inline-block')
        }
    });

    socket.on('endGame', function() {
        $('.imgGlow').removeClass("imgGlow");
        $('#endButton').fadeOut();
        var cards = $('#middleCards');
        cards.collapse('hide');
        var txt = $('#choosing');
        txt.text('Host has ended the game.');
        cards.on('hidden.bs.collapse', function() {
            setTimeout(function() {
                var form = $("#collapseForm");
                form.collapse('show');
                txt.addClass('blink');
                txt.text('Host is choosing roles...');
            }, 1500);
        });
    });

    function showPlayerCards(usersAndRoles) {
        let i = 1;
        let j = 1;
        $("#playerCards").html('');
        Object.keys(usersAndRoles).forEach(function(key) {
            $("#playerCards").append(
                '            <div class="col-4 col-md-2">\n' +
                '                <div class="card" id="hiddenPlayer' + i + '" data-target="#playerImg' + i + '" style="background-color: unset; border: unset; visibility: hidden">\n' +
                '                    <img class="card-img" id="playerImg' + i + '" src="https://i.imgur.com/8NKNBHL.png" alt="Card image">\n' +
                '                    <div class="card-img-overlay">\n' +
                '                    </div><p id="playerCard' + i + '"class="text-white mt-1 text-center"></p>\n' +
                '                </div>\n' +
                '            </div>'
            );
            $('#playerCard' + i).text(key);
            setTimeout(function() {
                $("#hiddenPlayer" + j).css({opacity: 0.0, visibility: "visible"}).animate({opacity: 1.0}, 500);
                j++;
            }, i*200);
            i++;
        })
    }

});



