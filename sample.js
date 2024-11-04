var _currentUserId;
var currentSipCallId;
var xucToken;
var _lineCfg;

$(function () {
    console.log("Xuc sample API - init");
    $('#xuc_logoff_panel').hide();
    $('#xuc_webrtc_video').hide();

    var xucserver = window.location.hostname + ":" + window.location.port;
    $('#xuc_server').val(xucserver);

    $('#xuc_username').val(localStorage.getItem('sampleUsername'));
    $('#xuc_password').val(localStorage.getItem('samplePassword'));
    $('#xuc_phoneNumber').val(localStorage.getItem('samplePhoneNumber'));

    $('#xuc_sign_in').click(function (event) {
        var server = $('#xuc_server').val();
        var username = $('#xuc_username').val();
        var password = $('#xuc_password').val();
        var phoneNumber = $('#xuc_phoneNumber').val();
        var softwareType = $('#xuc_softwareType').val();
        var applicationType = $('#xuc_applicationType').val();
        var payload = { "login": username, "password": password }
        if (softwareType) {
            payload.softwareType = softwareType;
        }
        if (applicationType) {
            payload.applicationType = applicationType;
        }
        localStorage.setItem('sampleUsername', username);
        localStorage.setItem('samplePassword', password);
        localStorage.setItem('samplePhoneNumber', phoneNumber);
        var wsProto = window.location.protocol === "http:" ? 'ws://' : 'wss://';

        console.log("sign in " + server + " : " + username + " " + password + " " + phoneNumber);
        makeAuthCall("POST", "/xuc/api/2.0/auth/login",
            payload).success(function (data) {
                $('#xuc_token').val(data.token);
                xucToken = data.token;
                init(username, password, phoneNumber, wsProto + server + "/xuc/api/2.0/cti?token=" + xucToken);
            }).fail(function (sender, message, details) {
                var error = "Impossible to retrieve auth token for user " + username;
                generateMessage(error, true, true);
            });
    });
    $('#xuc_restart').click(function (event) {
        Cti.close();
        var server = $('#xuc_server').val();
        var username = $('#xuc_username').val();
        var password = $('#xuc_password').val();
        var phoneNumber = $('#xuc_phoneNumber').val();
        var token = $('#xuc_token').val();
        var wsProto = window.location.protocol === "http:" ? 'ws://' : 'wss://';
        var wsurl = wsProto + server + "api/2.0/cti?token=" + token;
        Cti.WebSocket.init(wsurl, username, phoneNumber);
    });
});

function generateMessage(message, isError) {
    var className = (isError) ? 'danger' : 'success';
    $('#main_errors').html('<p class="alert alert-' + className + ' alert-dismissible"><button type="button" class="close" data-dismiss="alert" aria-label="Close"><span aria-hidden="true">&times;</span></button>' + new Date().toLocaleString() + ": " + JSON.stringify(message) + '</p>');
    console.log(message);
}

function userConfigHandler(event) {
    console.log("user config Handler " + JSON.stringify(event));
    $('#xuc_userId').text(event.userId);
    _currentUserId = event.userId;
    $('#xuc_fullName').text(event.fullName);
    $('#xuc_mobileNumber').text(event.mobileNumber);
    $('#xuc_agentId').text(event.agentId);
    $('#xuc_voiceMailId').text(event.voiceMailId);
    $('#xuc_voiceMailEnabled').text(event.voiceMailEnabled);
    if (event.naFwdDestination !== null) {
        $('#xuc_naFwdEnabled').prop('checked', event.naFwdEnabled);
        $('#xuc_naFwdDestination').val(event.naFwdDestination);
    }
    if (event.uncFwdDestination !== null) {
        $('#xuc_uncFwdEnabled').prop('checked', event.uncFwdEnabled);
        $('#xuc_uncFwdDestination').val(event.uncFwdDestination);
    }

    if (event.busyFwdDestination !== null) {
        console.log("busy fwd " + event.busyFwdEnabled);
        $('#xuc_busyFwdEnabled').prop('checked', event.busyFwdEnabled);
        $('#xuc_busyFwdDestination').val(event.busyFwdDestination);
    }
}
function phoneStatusHandler(event) {
    console.log("phone Status Handler " + JSON.stringify(event));
    $('#xuc_phoneStatus').val(event.status);
}

function phoneHintStatusEventHandler(event) {
    console.log("phone Status Handler " + JSON.stringify(event));
    $('#phone_hints').prepend('<li class="list-group-item event-item"><pre><code>' + JSON.stringify(event) + '</code></pre></li>');
}

function voiceMailStatusHandler(event) {
    $('#xuc_newMessages').text(event.newMessages);
    $('#xuc_waitingMessages').text(event.waitingMessages);
    $('#xuc_oldMessages').text(event.oldMessages);
}

function linkStatusHandler(event) {
    console.log("link Status Handler " + JSON.stringify(event));
    if (event.status === "closed") {
        $('#xuc_logon_panel').show();
        $('#xuc_logoff_panel').hide();
    }
}

function loggedOnHandler() {
    console.log("Logged On Handler ");
    $('#xuc_logon_panel').hide();
    $('#xuc_logoff_panel').show();
    Cti.getConfig('line');
}


function errorHandler(error) {
    generateMessage(error, true);
}

function phoneEventHandler(event) {
    if (event && event.userData) currentSipCallId = event.userData.SIPCALLID;
    console.log('Phone Event handler' + JSON.stringify(event));
    $('#phone_events').prepend('<li class="list-group-item event-item"><pre><code>' + JSON.stringify(event) + '</code></pre></li>');
    $('#last_phone_event').html(
        '<p class="text-normal"><pre><code>' + new Date().toLocaleString() + ": " + JSON.stringify(event) + '</code></pre></p>');

}
function lineConfigHandler(lineCfg) {
    _lineCfg = lineCfg;
}

function webRtcGeneralEventHandler(event) {
    console.log('WebRTC Event handler' + JSON.stringify(event));
    $('#webrtc_events').prepend('<li class="list-group-item event-item"><pre><code>GeneralEvent: ' + JSON.stringify(event) + '</code></pre></li>');
}
function webRtcRegistrationEventHandler(event) {
    console.log('WebRTC Event handler' + JSON.stringify(event));
    $('#webrtc_events').prepend('<li class="list-group-item event-item"><pre><code>RegistrationEvent: ' + JSON.stringify(event) + '</code></pre></li>');
}
function webRtcIncomingEventHandler(event) {
    console.log('WebRTC Event handler' + JSON.stringify(event));
    $('#webrtc_events').prepend('<li class="list-group-item event-item"><pre><code>IncomingEvent: ' + JSON.stringify(event) + '</code></pre></li>');
}
function webRtcOutgoingEventHandler(event) {
    console.log('WebRTC Event handler' + JSON.stringify(event));
    $('#webrtc_events').prepend('<li class="list-group-item event-item"><pre><code>OutgoingEvent: ' + JSON.stringify(event) + '</code></pre></li>');
}

$('#xuc_answer_btn').click(function (event) {
    Cti.answer();
});
$('#xuc_hangup_btn').click(function (event) {
    Cti.hangup();
});
$('#xuc_search_btn').click(function (event) {
    Cti.searchDirectory($("#xuc_destination").val());
});
$('#xuc_enable_dnd_btn').click(function (event) {
    Cti.dnd(true);
});
$('#xuc_disable_dnd_btn').click(function (event) {
    Cti.dnd(false);
});
$('#xuc_dial_btn').click(function (event) {
    var variables = extractVariables($("#xuc_dial_variables").val());
    Cti.dial($("#xuc_destination").val(), variables);
});
$('#xuc_hold_btn').click(function (event) {
    Cti.hold();
});
$('#xuc_dial_mobile_btn').click(function (event) {
    var variables = extractVariables($("#xuc_dial_variables").val());
    Cti.dialFromMobile($("#xuc_destination").val(), variables);
});
$('#xuc_dial_username_btn').click(function (event) {
    var variables = extractVariables($("#xuc_dial_variables").val());
    Cti.dialByUsername($("#xuc_destination").val(), variables);
});
$('#xuc_setdata_btn').click(function (event) {
    var variables = extractVariables($("#xuc_dial_variables").val());
    Cti.setData(variables);
});
$('#xuc_direct_transfer_btn').click(function (event) {
    Cti.directTransfer($("#xuc_destination").val());
});
$('#xuc_attended_transfer_btn').click(function (event) {
    Cti.attendedTransfer($("#xuc_destination").val());
});
$('#xuc_complete_transfer_btn').click(function (event) {
    Cti.completeTransfer();
});
$('#xuc_cancel_transfer_btn').click(function (event) {
    Cti.cancelTransfer();
});
$('#xuc_send_dtmf_btn').click(function (event) {
    Cti.sendDtmf($('#xuc_cti_dtmf').val());
});
$('#xuc_clean_phone_events').click(function (event) {
    $('#phone_events').empty();
});
$('#xuc_subscribe_to_phone_hints').click(function (event) {
    Cti.subscribeToPhoneHints($('#xuc_phone_hint_subscription').val().split(','));
});
$('#xuc_unsubscribe_from_phone_hints').click(function (event) {
    Cti.unsubscribeFromAllPhoneHints();
});
$('#xuc_clean_phone_hints').click(function (event) {
    $('#phone_hints').empty();
});

$('#xuc_get_current_calls_phone_events').click(function (event) {
    Cti.getCurrentCallsPhoneEvents();
});

$('#xuc_naFwdEnabled').click(function () {
    console.log($(this).is(':checked'));
    Cti.naFwd($("#xuc_naFwdDestination").val(), $(this).is(':checked'));
    $(this).prop('checked', !($(this).is(':checked')));
});
$('#xuc_uncFwdEnabled').click(function () {
    console.log($(this).is(':checked'));
    Cti.uncFwd($("#xuc_uncFwdDestination").val(), $(this).is(':checked'));
    $(this).prop('checked', !($(this).is(':checked')));
});
$('#xuc_busyFwdEnabled').click(function () {
    console.log($(this).is(':checked'));
    Cti.busyFwd($("#xuc_busyFwdDestination").val(), $(this).is(':checked'));
    $(this).prop('checked', !($(this).is(':checked')));
});


$('#xuc_clean_webrtc_events').click(function (event) {
    $('#webrtc_events').empty();
});
$('#xuc_init_webrtc').click(function () {
    console.log("initwebrtc", _lineCfg);
    if (window.location.hostname === "127.0.0.1" || window.location.hostname === "localhost") {
        xc_webrtc.initByLineConfig(_lineCfg, $('#xuc_fullName').text(), false, 5039, xucToken);
    } else {
        var wss = window.location.protocol === "http:" ? false : true;
        xc_webrtc.initByLineConfig(_lineCfg, $('#xuc_fullName').text(), wss, window.location.port, xucToken, 'audio_remote', window.location.hostname);
    }
});
$('#xuc_toggle_ua').click(function () {
    xc_webrtc.stop();
    Cti.toggleUniqueAccountDevice($("input[name='deviceType']:checked").val());
});
$('#xuc_stop_webrtc').click(function () {
    xc_webrtc.stop();
});
$('#xuc_webrtc_dial').click(function () {
    xc_webrtc.dial($('#xuc_webrtc_dst').val());
});
$('#xuc_webrtc_dial_video').click(function () {
    xc_webrtc.dial($('#xuc_webrtc_dst').val(), true);
    $('#xuc_webrtc_video').show();
});
$('#xuc_webrtc_dst').keypress(function (e) {
    if (e.which == $.ui.keyCode.ENTER) {
        xc_webrtc.dial($('#xuc_webrtc_dst').val());
    }
});
$('#xuc_webrtc_answer').click(function () {
    xc_webrtc.answer();
});
$('#xuc_webrtc_hangup').click(function () {
    $('#xuc_webrtc_video').hide();
    Cti.hangup();
});
$('#xuc_webrtc_send_dtmf').click(function () {
    xc_webrtc.dtmf($('#xuc_webrtc_dtmf').val());
});
$('#xuc_webrtc_dtmf').keypress(function (e) {
    if (e.which == $.ui.keyCode.ENTER) {
        xc_webrtc.dtmf($('#xuc_webrtc_dtmf').val());
    }
});
$('#xuc_webrtc_hold').click(function () {
    xc_webrtc.hold();
});
$('#xuc_webrtc_attended_transfer_btn').click(function () {
    xc_webrtc.attendedTransfer($('#xuc_webrtc_dst').val());
});
$('#xuc_webrtc_complete_transfer_btn').click(function () {
    xc_webrtc.completeTransfer();
});
$('#xuc_webrtc_conference_btn').click(function () {
    xc_webrtc.conference();
});
$('#xuc_webrtc_toggle_microphone').click(function () {
    xc_webrtc.toggleMicrophone(currentSipCallId);
});
$('#xuc_mobile_push_set_btn').click(function (event) {
    makeAuthCall('POST', "/xuc/api/2.0/mobile/push/register", { token: $('#xuc_mobile_push').val() }).success(function (data) {
        generateMessage("Mobile push notification is set");
    }).fail(function (sender, message, details) {
        generateMessage("Impossible to set mobile push notification for this user", true);
    });
});

$('#xuc_mobile_push_unregister').click(function (event) {
    Cti.unregisterMobileApp();
});

function init(username, password, phoneNumber, wsurl) {
    Cti.debugMsg = true;
    Cti.debugHandler = false;
    Cti.clearHandlers();
    Cti.setHandler(Cti.MessageType.LOGGEDON, loggedOnHandler);

    Cti.setHandler(Cti.MessageType.USERCONFIGUPDATE, userConfigHandler);
    Cti.setHandler(Cti.MessageType.PHONESTATUSUPDATE, phoneStatusHandler);
    Cti.setHandler(Cti.MessageType.PHONEHINTSTATUSEVENT, phoneHintStatusEventHandler);
    Cti.setHandler(Cti.MessageType.VOICEMAILSTATUSUPDATE, voiceMailStatusHandler);
    Cti.setHandler(Cti.MessageType.LINKSTATUSUPDATE, linkStatusHandler);

    Cti.setHandler(Cti.MessageType.ERROR, errorHandler);

    Cti.setHandler(Cti.MessageType.PHONEEVENT, phoneEventHandler);
    Cti.setHandler(Cti.MessageType.CURRENTCALLSPHONEEVENTS, phoneEventHandler);
    Cti.setHandler(Cti.MessageType.LINECONFIG, lineConfigHandler);
    Cti.setHandler(Cti.MessageType.USERPREFERENCE, userPreferenceHandler);

    xc_webrtc.clearHandlers();
    xc_webrtc.setHandler(xc_webrtc.MessageType.GENERAL, webRtcGeneralEventHandler);
    xc_webrtc.setHandler(xc_webrtc.MessageType.REGISTRATION, webRtcRegistrationEventHandler);
    xc_webrtc.setHandler(xc_webrtc.MessageType.INCOMING, webRtcIncomingEventHandler);
    xc_webrtc.setHandler(xc_webrtc.MessageType.OUTGOING, webRtcOutgoingEventHandler);

    Cti.WebSocket.init(wsurl, username, phoneNumber);
    Callback.init(Cti);
    Membership.init(Cti);

    // sampleContacts.js
    initContacts();

    // sampleHistory.js
    initHistory();

    // sampleConferences.js
    initConferences();

    //sampleFlashText.js
    initFlashText();

    // sampleQueues.js
    initQueues();

    // sampleAgents.js
    initAgents();

    // sampleMeetingRooms.js
    initMeetingRooms();
}