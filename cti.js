/* eslint-disable indent */

var Cti = {
    debugMsg : false,
    debugHandler : false,
    sendCallback : function(message) {
      if (Cti.debugHandler){
        console.log('web socket not initialized to send' + JSON.stringify(message));
      }
    },
    init : function(username, agentNumber, webSocket) {
        this.username = username;
        this.agentNumber = agentNumber;
        this.sendCallback = webSocket.sendCallback;
        this.webSocket = webSocket;
    },

    close: function() {
        this.webSocket.close();
    },

    Topic : function(id) {
        if (typeof(jQuery) !== "undefined") {
            var callbacks, topic = id && Cti.ctiTopics[id];
            if (!topic) {
                callbacks = jQuery.Callbacks();
                topic = {
                    publish : callbacks.fire,
                    subscribe : callbacks.add,
                    unsubscribe : callbacks.remove,
                    clear : callbacks.empty
                };
                if (id) {
                    Cti.ctiTopics[id] = topic;
                }
            }
            return topic;
        }
        else if (typeof(SHOTGUN) !== "undefined") {
            return {
                clear : function(){
                    try{
                        SHOTGUN.remove('cti');
                    }catch(e){
                        console.error("Unable to clear cti handlers, ", e);
                    }
                },
                publish : function(val){
                    SHOTGUN.fire('cti/'+id,[val]);
                },
                subscribe : function(handler){
                    SHOTGUN.listen('cti/'+id,handler);
                },
                unsubscribe : function(handler){
                    console.error("Unsubscribe not implemented using shotgun");
                }
            };
        } else {
            console.error("No callback handler available ! Neither jQuery nor SHOTGUN is available.");
        }
    },

  setHandler: function (eventName, handler) {
    Cti.Topic(eventName).unsubscribe(handler);
    Cti.Topic(eventName).subscribe(handler);
    if (Cti.debugHandler) {
      console.log("subscribing : [" + eventName + "] to " + handler);
    }
  },

  unsetHandler: function (eventName, handler) {
    Cti.Topic(eventName).unsubscribe(handler);
    if (Cti.debugHandler) {
      console.log("unsubscribing : [" + eventName + "] to " + handler);
    }
  },

  clearHandlers: function () {
    Cti.Topic().clear();
  },

    receive : function(event) {
        var message = this.getMessage(event.data);
        if (message === null) {
            console.log("WARNING: No message in decoded json data: " + data);
            throw new TypeError("No message in decoded json data");
        }
        if (Cti.debugMsg){
            console.log("RS<<< " + JSON.stringify(message));
        }
        try{
            Cti.Topic(message.msgType).publish(message.ctiMessage);
        }catch(e){
            console.error(message.msgType,message.ctiMessage,e);
        }
        Cti.msgReceived ++;
    },

    getMessage : function(jsonData) {
        try {
            return JSON.parse(jsonData);
        } catch (err) {
            console.log("ERROR: " + err + ", event.data not json encoded: " + jsonData);
            throw new TypeError("Json parse of received data failed");
        }
    },
    sendPing : function() {
        console.log("rec "+ Cti.msgReceived + " " + Cti.ctiChannelSocket);
        Cti.msgReceived = 0;
        var message = Cti.WebsocketMessageFactory.createPing();
        Cti.sendCallback(message);
    },
    changeUserStatus : function(statusId) {
        var message = Cti.WebsocketMessageFactory.createUserStatusUpdate(statusId);
        this.sendCallback(message);
    },
    loginAgent : function(agentPhoneNumber, agentId) {
        var message = Cti.WebsocketMessageFactory.createAgentLogin(agentPhoneNumber, agentId);
        this.sendCallback(message);
    },
    logoutAgent : function(agentId) {
        var message = Cti.WebsocketMessageFactory.createAgentLogout(agentId);
        this.sendCallback(message);
    },
    pauseAgent : function(agentId, reason) {
        var message = Cti.WebsocketMessageFactory.createPauseAgent(agentId, reason);
        this.sendCallback(message);
    },
    unpauseAgent : function(agentId) {
        var message = Cti.WebsocketMessageFactory.createUnpauseAgent(agentId);
        this.sendCallback(message);
    },
    listenAgent : function(agentId) {
        var args ={'agentid' : agentId};
        var message = Cti.WebsocketMessageFactory.createMessageFromArgs(Cti.WebsocketMessageFactory.listenAgentCmd, args);
        this.sendCallback(message);
    },
    dnd : function(state) {
        var message = Cti.WebsocketMessageFactory.createDnd(state);
        this.sendCallback(message);
    },
    dial : function(destination, variables) {
        var message = Cti.WebsocketMessageFactory.createDial(destination, variables);
        this.sendCallback(message);
    },
    dialFromMobile : function(destination, variables) {
        var message = Cti.WebsocketMessageFactory.createDialMobile(destination, variables);
        this.sendCallback(message);
    },
    dialFromQueue : function(destination, queueId, callerIdName, callerIdNumber, variables) {
        var message = Cti.WebsocketMessageFactory.createDialFromQueue(destination, queueId, callerIdName, callerIdNumber, variables);
        this.sendCallback(message);
    },
    dialByUsername : function(username, variables) {
        var message = Cti.WebsocketMessageFactory.createDialByUsername(username, variables);
        this.sendCallback(message);
    },
    originate : function(destination) {
        var message = Cti.WebsocketMessageFactory.createOriginate(destination);
        this.sendCallback(message);
    },
    hangup : function(uniqueId) {
        var message = Cti.WebsocketMessageFactory.createHangup(uniqueId);
        this.sendCallback(message);
    },
    answer : function(uniqueId) {
        var message = Cti.WebsocketMessageFactory.createAnswer(uniqueId);
        this.sendCallback(message);
    },
    hold : function(uniqueId) {
        var message = Cti.WebsocketMessageFactory.createHold(uniqueId);
        this.sendCallback(message);
    },
    directTransfer : function(destination) {
        var message = Cti.WebsocketMessageFactory.createDirectTransfer(destination);
        this.sendCallback(message);
    },
    attendedTransfer : function(destination, device) {
        var message = Cti.WebsocketMessageFactory.createAttendedTransfer(destination, device);
        this.sendCallback(message);
    },
    completeTransfer : function() {
        var message = Cti.WebsocketMessageFactory.createCompleteTransfer();
        this.sendCallback(message);
    },
    cancelTransfer : function() {
        var message = Cti.WebsocketMessageFactory.createCancelTransfer();
        this.sendCallback(message);
    },
    toggleMicrophone: function(uniqueId) {
        var message = Cti.WebsocketMessageFactory.createToggleMicrophone(uniqueId);
        this.sendCallback(message);
    },
    conference : function() {
        var message = Cti.WebsocketMessageFactory.createConference();
        this.sendCallback(message);
    },
    conferenceInvite : function(numConf, exten, role, earlyJoin, variables, marked, leaveWhenLastMarkedLeave, callerId) {
      var message = Cti.WebsocketMessageFactory.createConferenceInvite(numConf, exten, role, earlyJoin, variables, marked, leaveWhenLastMarkedLeave, callerId);
      this.sendCallback(message);
    },
    conferenceMute : function(numConf, index) {
      var message = Cti.WebsocketMessageFactory.createConferenceMute(numConf, index);
      this.sendCallback(message);
    },
    conferenceUnmute : function(numConf, index) {
      var message = Cti.WebsocketMessageFactory.createConferenceUnmute(numConf, index);
      this.sendCallback(message);
    },
    conferenceMuteAll : function(numConf) {
        var message = Cti.WebsocketMessageFactory.createConferenceMuteAll(numConf);
        this.sendCallback(message);
    },
    conferenceUnmuteAll : function(numConf) {
        var message = Cti.WebsocketMessageFactory.createConferenceUnmuteAll(numConf);
        this.sendCallback(message);
    },
    conferenceMuteMe : function(numConf) {
        var message = Cti.WebsocketMessageFactory.createConferenceMuteMe(numConf);
        this.sendCallback(message);
    },
    conferenceUnmuteMe : function(numConf) {
        var message = Cti.WebsocketMessageFactory.createConferenceUnmuteMe(numConf);
        this.sendCallback(message);
    },
    conferenceKick : function(numConf, index) {
      var message = Cti.WebsocketMessageFactory.createConferenceKick(numConf, index);
      this.sendCallback(message);
    },
    conferenceDeafen : function(numConf, index) {
      var message = Cti.WebsocketMessageFactory.createConferenceDeafen(numConf, index);
      this.sendCallback(message);
    },
    conferenceUndeafen : function(numConf, index) {
      var message = Cti.WebsocketMessageFactory.createConferenceUndeafen(numConf, index);
      this.sendCallback(message);
    },
    conferenceReset : function(numConf) {
      var message = Cti.WebsocketMessageFactory.createConferenceReset(numConf);
      this.sendCallback(message);
    },
    conferenceClose : function(numConf) {
      var message = Cti.WebsocketMessageFactory.createConferenceClose(numConf);
      this.sendCallback(message);
    },
    includeToConference : function(role, marked, leaveWhenLastMarkedLeave, callerId) {
      var message = Cti.WebsocketMessageFactory.createIncludeToConference(role, marked, leaveWhenLastMarkedLeave, callerId);
      this.sendCallback(message);
    },
    subscribeToQueueStats : function() {
        var message = Cti.WebsocketMessageFactory.createSubscribeToQueueStats();
        this.sendCallback(message);
    },
    subscribeToQueueCalls : function(queueId) {
        var message = Cti.WebsocketMessageFactory.createSubscribeToQueueCalls(queueId);
        this.sendCallback(message);
    },
    unSubscribeToQueueCalls : function(queueId) {
        var message = Cti.WebsocketMessageFactory.createUnSubscribeToQueueCalls(queueId);
        this.sendCallback(message);
    },
    subscribeToAgentStats : function() {
        var message = Cti.WebsocketMessageFactory.createSubscribeToAgentStats();
        this.sendCallback(message);
    },
    getQueueStatistics : function(queueId, window, xqos) {
        var message = Cti.WebsocketMessageFactory.createGetQueueStatistics(queueId, window, xqos);
        this.sendCallback(message);
    },
    subscribeToAgentEvents : function() {
        var message = Cti.WebsocketMessageFactory.createSubscribeToAgentEvents();
        this.sendCallback(message);
    },
    getAgentStates : function() {
        var message = Cti.WebsocketMessageFactory.createGetAgentStates();
        this.sendCallback(message);
    },
    getConfig : function(objectType) {
        var message = Cti.WebsocketMessageFactory.createGetConfig(objectType);
        this.sendCallback(message);
    },
    getIceConfig : function() {
        var message = Cti.WebsocketMessageFactory.createGetIceConfig();
        this.sendCallback(message);
    },
    getList : function(objectType) {
        var message = Cti.WebsocketMessageFactory.createGetList(objectType);
        this.sendCallback(message);
    },
    getAgentDirectory : function() {
        var message = Cti.WebsocketMessageFactory.createGetAgentDirectory();
        this.sendCallback(message);
    },
    getConferenceRooms : function() {
        var message = Cti.WebsocketMessageFactory.createGetList("meetme");
        this.sendCallback(message);
    },
    setAgentQueue : function(agentId, queueId, penalty) {
        var message = Cti.WebsocketMessageFactory.createSetAgentQueue(agentId, queueId, penalty);
        this.sendCallback(message);
    },
    removeAgentFromQueue : function(agentId,queueId) {
        var message = Cti.WebsocketMessageFactory.createRemoveAgentFromQueue(agentId,queueId);
        this.sendCallback(message);
    },
    moveAgentsInGroup : function(groupId, fromQueueId, fromPenalty, toQueueId, toPenalty) {
        var args = {};
        args.groupId = groupId;
        args.fromQueueId = fromQueueId;
        args.fromPenalty = fromPenalty;
        args.toQueueId = toQueueId;
        args.toPenalty = toPenalty;

        var message = Cti.WebsocketMessageFactory.createMessageFromArgs(Cti.WebsocketMessageFactory.moveAgentsInGroupCmd, args);
        this.sendCallback(message);

    },
    addAgentsInGroup : function(groupId, fromQueueId, fromPenalty, toQueueId, toPenalty) {
        var args = {};
        args.groupId = groupId;
        args.fromQueueId = fromQueueId;
        args.fromPenalty = fromPenalty;
        args.toQueueId = toQueueId;
        args.toPenalty = toPenalty;

        var message = Cti.WebsocketMessageFactory.createMessageFromArgs(Cti.WebsocketMessageFactory.addAgentsInGroupCmd, args);
        this.sendCallback(message);
    },
    removeAgentGroupFromQueueGroup: function(groupId, queueId, penalty) {
        var args ={'groupId' : groupId, 'queueId' : queueId, 'penalty' : penalty};

        var message = Cti.WebsocketMessageFactory.createMessageFromArgs(Cti.WebsocketMessageFactory.removeAgentGroupFromQueueGroupCmd, args);
        this.sendCallback(message);
    },
    addAgentsNotInQueueFromGroupTo: function(groupId, queueId, penalty) {
        var args ={'groupId' : groupId, 'queueId' : queueId, 'penalty' : penalty};

        var message = Cti.WebsocketMessageFactory.createMessageFromArgs(Cti.WebsocketMessageFactory.addAgentsNotInQueueFromGroupToCmd, args);
        this.sendCallback(message);
    },
    monitorPause: function(agentId) {
        var args = {'agentid' : agentId};

        var message = Cti.WebsocketMessageFactory.createMessageFromArgs(Cti.WebsocketMessageFactory.monitorPause, args);
        this.sendCallback(message);
    },
    monitorUnpause: function(agentId) {
        var args = {'agentid' : agentId};

    let message = Cti.WebsocketMessageFactory.createMessageFromArgs(Cti.WebsocketMessageFactory.monitorUnpause, args);
    this.sendCallback(message);
  },
  inviteConferenceRoom: function (userId) {
    let message = Cti.WebsocketMessageFactory.createInviteConferenceRoom(userId);
    this.sendCallback(message);
  },
  naFwd: function (destination, state) {
    let args = {'state': state, 'destination': destination};
    let message = Cti.WebsocketMessageFactory.createMessageFromArgs(Cti.WebsocketMessageFactory.naFwd, args);
    this.sendCallback(message);
  },
  uncFwd: function (destination, state) {
    let args = {'state': state, 'destination': destination};
    let message = Cti.WebsocketMessageFactory.createMessageFromArgs(Cti.WebsocketMessageFactory.uncFwd, args);
    this.sendCallback(message);
  },
  busyFwd: function (destination, state) {
    let args = {'state': state, 'destination': destination};
    let message = Cti.WebsocketMessageFactory.createMessageFromArgs(Cti.WebsocketMessageFactory.busyFwd, args);
    this.sendCallback(message);
  },
  getAgentCallHistory: function (size) {
    let args = {'size': size};
    let message = Cti.WebsocketMessageFactory.createMessageFromArgs(Cti.WebsocketMessageFactory.getAgentCallHistoryCmd, args);
    this.sendCallback(message);
  },
  findCustomerCallHistory: function (requestId, filters, size) {
    let args = {'id': requestId, 'request': {'filters': filters, 'size': size}};
    let message = Cti.WebsocketMessageFactory.createMessageFromArgs(Cti.WebsocketMessageFactory.findCustomerCallHistoryCmd, args);
    this.sendCallback(message);
  },
  getUserCallHistory: function (size) {
    let args = {'size': size};
    let message = Cti.WebsocketMessageFactory.createMessageFromArgs(Cti.WebsocketMessageFactory.getUserCallHistoryCmd, args);
    this.sendCallback(message);
  },
  getUserCallHistoryByDays: function (days) {
    let args = {'days': days};
    let message = Cti.WebsocketMessageFactory.createMessageFromArgs(Cti.WebsocketMessageFactory.getUserCallHistoryByDaysCmd, args);
    this.sendCallback(message);
  },
  getQueueCallHistory: function (queue, size) {
    let args = {'queue': queue, 'size': size};
    let message = Cti.WebsocketMessageFactory.createMessageFromArgs(Cti.WebsocketMessageFactory.getQueueCallHistoryCmd, args);
    this.sendCallback(message);
  },
  setAgentGroup: function (agentId, groupId) {
    let message = Cti.WebsocketMessageFactory.createSetAgentGroup(agentId, groupId);
    this.sendCallback(message);
  },
  // deprecated
  directoryLookUp: function (term) {
    console.warn('directoryLookUp is deprecated - Please use searchContacts instead');
    let message = Cti.WebsocketMessageFactory.createDirectoryLookUp(term);
    this.sendCallback(message);
  },
  searchContacts: function (term) {
      let message = Cti.WebsocketMessageFactory.createSearchContacts(term);
      this.sendCallback(message);
  },
  // deprecated
  getFavorites: function () {
    console.warn('getFavorites is deprecated - Please use getFavoriteContacts instead');
    let message = Cti.WebsocketMessageFactory.createGetFavorites();
    this.sendCallback(message);
  },
  getFavoriteContacts: function () {
    let message = Cti.WebsocketMessageFactory.createGetFavoriteContacts();
    this.sendCallback(message);
  },
  addFavorite: function (contactId, source) {
    let message = Cti.WebsocketMessageFactory.createAddFavorite(contactId, source);
    this.sendCallback(message);
  },
  removeFavorite: function (contactId, source) {
    let message = Cti.WebsocketMessageFactory.createRemoveFavorite(contactId, source);
    this.sendCallback(message);
  },
  setData: function (variables) {
    let args = {'variables': variables};
    let message = Cti.WebsocketMessageFactory.createMessageFromArgs(Cti.WebsocketMessageFactory.setDataCmd, args);
    this.sendCallback(message);
  },
  getCurrentCallsPhoneEvents: function () {
    let message = Cti.WebsocketMessageFactory.createGetCurrentCallsPhoneEvents();
    this.sendCallback(message);
  },
  sendDtmf: function (key) {
    let args = {'key': key};
    let message = Cti.WebsocketMessageFactory.createMessageFromArgs(Cti.WebsocketMessageFactory.sendDtmf, args);
    this.sendCallback(message);
  },
  sendFlashTextMessage: function (to, seq, message) {
    let m = Cti.WebsocketMessageFactory.createFlashTextRequest('FlashTextDirectMessage', to, seq, message);
    this.sendCallback(m);
  },
  getFlashTextPartyHistory: function (to, seq) {
    let m = Cti.WebsocketMessageFactory.createFlashTextRequest('FlashTextDirectMessageHistory', to, seq);
    this.sendCallback(m);
  },
  markFlashTextAsRead: function (to, seq) {
    let m = Cti.WebsocketMessageFactory.createFlashTextRequest('FlashTextMarkAsRead', to, seq);
    this.sendCallback(m);
  },
  subscribeToPhoneHints: function (phoneNumbers) {
    let args = {'phoneNumbers': phoneNumbers};
    let message = Cti.WebsocketMessageFactory.createMessageFromArgs(Cti.WebsocketMessageFactory.subscribeToPhoneHints, args);
    this.sendCallback(message);
  },
  unsubscribeFromAllPhoneHints: function () {
    let message = Cti.WebsocketMessageFactory.createMessage(Cti.WebsocketMessageFactory.unsubscribeFromAllPhoneHints);
    this.sendCallback(message);
  },
  retrieveQueueCall: function (queueCall) {
    let args = {'queueCall': queueCall};
    let message = Cti.WebsocketMessageFactory.createMessageFromArgs(Cti.WebsocketMessageFactory.retrieveQueueCall, args);
    this.sendCallback(message);
  },
  toggleUniqueAccountDevice: function (device) {
    let args = {'deviceType': device};
    let message = Cti.WebsocketMessageFactory.createMessageFromArgs(Cti.WebsocketMessageFactory.toggleUniqueAccountDevice, args);
    this.sendCallback(message);
  },
  displayNameLookup: function (username) {
    let args = {'username': username};
    let message = Cti.WebsocketMessageFactory.createMessageFromArgs(Cti.WebsocketMessageFactory.displayNameLookup, args);
    this.sendCallback(message);
  },
  dialByUsername: function (username) {
    let args = {'username': username};
    let message = Cti.WebsocketMessageFactory.createMessageFromArgs(Cti.WebsocketMessageFactory.dialByUsername, args);
    this.sendCallback(message);
  },
  pushLogToServer: function (level, log) {
    let args = {'level': level, 'log': log};
    let message = Cti.WebsocketMessageFactory.createMessageFromArgs(Cti.WebsocketMessageFactory.pushLogToServer, args);
    this.sendCallback(message);
  },
  videoEvent: function (status) {
    let args = {'status': status};
    let message = Cti.WebsocketMessageFactory.createMessageFromArgs(Cti.WebsocketMessageFactory.videoEvent, args);
    this.sendCallback(message);
  },
  subscribeToVideoStatus: function (usernames) {
    let args = {'usernames': usernames};
    let message = Cti.WebsocketMessageFactory.createMessageFromArgs(Cti.WebsocketMessageFactory.subscribeToVideoStatus, args);
    this.sendCallback(message);
  },
  unsubscribeFromAllVideoStatus: function () {
    let message = Cti.WebsocketMessageFactory.createMessage(Cti.WebsocketMessageFactory.unsubscribeFromAllVideoStatus);
    this.sendCallback(message);
  },
  inviteToMeetingRoom: function (requestId, token, username) {
    let message = Cti.WebsocketMessageFactory.createInviteToMeetingRoom(requestId, token, username);
    this.sendCallback(message);
  },
  meetingRoomInviteAck: function (requestId, username) {
    let message = Cti.WebsocketMessageFactory.createMeetingRoomInviteAck(requestId, username);
    this.sendCallback(message);
  },
  meetingRoomInviteAccept: function (requestId, username) {
    let message = Cti.WebsocketMessageFactory.createMeetingRoomInviteAccept(requestId, username);
    this.sendCallback(message);
  },
  meetingRoomInviteReject: function (requestId, username) {
    let message = Cti.WebsocketMessageFactory.createMeetingRoomInviteReject(requestId, username);
    this.sendCallback(message);
  },
  setUserPreference: function (key, value, value_type) {
    let message = Cti.WebsocketMessageFactory.createMessage(Cti.WebsocketMessageFactory.setUserPreference);
    message.key = key;
    message.value = value;
    message.value_type = value_type;
    this.sendCallback(message);
  },
  unregisterMobileApp: function () {
    let message = Cti.WebsocketMessageFactory.createMessage(Cti.WebsocketMessageFactory.unregisterMobileApp);
    this.sendCallback(message);
  },

};
Cti.ctiTopics = {};

Cti.MessageType = {
    ERROR : "Error",
    LOGGEDON : "LoggedOn",
    SHEET : "Sheet",
    USERSTATUSES : "UsersStatuses",
    USERSTATUSUPDATE : "UserStatusUpdate",
    USERCONFIGUPDATE : "UserConfigUpdate",
    DIRECTORYRESULT : "DirectoryResult",
    PHONESTATUSUPDATE : "PhoneStatusUpdate",
    VOICEMAILSTATUSUPDATE : "VoiceMailStatusUpdate",
    LINKSTATUSUPDATE : "LinkStatusUpdate",
    QUEUESTATISTICS : "QueueStatistics",
    QUEUECONFIG : "QueueConfig",
    QUEUELIST : "QueueList",
    QUEUEMEMBER : "QueueMember",
    QUEUEMEMBERLIST : "QueueMemberList",
    QUEUECALLS : "QueueCalls",
    GETQUEUESTATISTICS : "GetQueueStatistics",
    AGENTCONFIG : "AgentConfig",
    AGENTDIRECTORY : "AgentDirectory",
    AGENTERROR : "AgentError",
    AGENTLIST : "AgentList",
    AGENTLISTEN: "AgentListen",
    AGENTSTATISTICS: "AgentStatistics",
    AGENTGROUPLIST : "AgentGroupList",
    AGENTSTATEEVENT : "AgentStateEvent",
    CONFERENCES: "ConferenceList",
    CONFERENCEEVENT: "ConferenceEvent",
    CONFERENCEPARTICIPANTEVENT: "ConferenceParticipantEvent",
    CONFERENCECOMMANDERROR: "ConferenceCommandError",
    CALLHISTORY: "CallHistory",
    RICHCALLHISTORY: "RichCallHistory",
    CALLHISTORYBYDAYS: "CallHistoryByDays",
    CUSTOMERCALLHISTORY: "CustomerCallHistoryResponseWithId",
    FAVORITES: "Favorites",
    FAVORITEUPDATED: "FavoriteUpdated",
    PHONEEVENT: "PhoneEvent",
    CURRENTCALLSPHONEEVENTS: "CurrentCallsPhoneEvents",
    PHONEHINTSTATUSEVENT: "PhoneHintStatusEvent",
    ICECONFIG: "IceConfig",
    LINECONFIG: "LineConfig",
    AUTHENTICATIONTOKEN: "AuthenticationToken",
    RIGHTPROFILE: "RightProfile",
    FLASHTEXTEVENT: "FlashTextEvent",
    WEBRTCCMD: "WebRTCCmd",
    USERDISPLAYNAME: "UserDisplayName",
    DIALBYUSERNAME: "DialByUsername",
    VIDEOEVENT: "VideoStatusEvent",
    MEETINGROOMINVITE: "MeetingRoomInvite",
    MEETINGROOMACK: "MeetingRoomInviteAck",
    MEETINGROOMRESPONSE: "MeetingRoomInviteResponse",
    USERPREFERENCE: "UserPreference",
    CTISTATUSES: "CtiStatuses",
    CONTACTSHEET: "ContactSheet",
    FAVORITECONTACTSHEET: "FavoriteContactSheet"
};

Cti.PhoneStatus = {
  ONHOLD: 16,
  RINGING: 8,
  INDISPONIBLE: 4,
  BUSY_AND_RINGING: 9,
  AVAILABLE: 0,
  CALLING: 1,
  BUSY: 2,
  DEACTIVATED: -1,
  UNEXISTING: -2,
  ERROR: -99
};

Cti.PhoneStatusColors = {
  "16": "#F7FE2E",
  "8": "#2E2EFE",
  "4": "#F2F2F2",
  "9": "#CC2EFA",
  "0": "#01DF01",
  "1": "#FF8000",
  "2": "#81BEF7",
  "-1": "#F2F2F2",
  "-2": "#F2F2F2",
  "-99": "#F2F2F2"
};

Cti.WebsocketMessageFactory = {

  messageClaz: "web",
  pingClaz: "ping",
  agentLoginCmd: "agentLogin",
  agentLogoutCmd: "agentLogout",
  userStatusUpdateCmd: "userStatusUpdate",
  dndCmd: "dnd",
  dialCmd: "dial",
  dialFromMobileCmd: "dialFromMobile",
  dialFromQueueCmd: "dialFromQueue",
  dialByUsernameCmd: "dialByUsername",
  originateCmd: "originate",
  pauseAgentCmd: "pauseAgent",
  unpauseAgentCmd: "unpauseAgent",


  
  listenAgentCmd: "listenAgent",
  subscribeToAgentStatsCmd: "subscribeToAgentStats",
  subscribeToQueueStatsCmd: "subscribeToQueueStats",
  subscribeToQueueCallsCmd: "subscribeToQueueCalls",
  unSubscribeToQueueCallsCmd: "unSubscribeToQueueCalls",
  hangupCmd: "hangup",
  answerCmd: "answer",
  holdCmd: "hold",
  directTransferCmd: "directTransfer",
  attendedTransferCmd: "attendedTransfer",
  completeTransferCmd: "completeTransfer",
  cancelTransferCmd: "cancelTransfer",
  toggleMicrophoneCmd: "toggleMicrophone",
  conferenceCmd: "conference",
  conferenceInviteCmd: "conferenceInvite",
  conferenceMuteCmd: "conferenceMute",
  conferenceUnmuteCmd: "conferenceUnmute",
  conferenceMuteAllCmd: "conferenceMuteAll",
  conferenceUnmuteAllCmd: "conferenceUnmuteAll",
  conferenceMuteMeCmd: "conferenceMuteMe",
  includeToConferenceCmd: "includeToConference",
  conferenceUnmuteMeCmd: "conferenceUnmuteMe",
  conferenceKickCmd: "conferenceKick",
  conferenceDeafenCmd: "conferenceDeafen",
  conferenceUndeafenCmd: "conferenceUndeafen",
  conferenceResetCmd: "conferenceReset",
  conferenceCloseCmd: "conferenceClose",
  getQueueStatisticsCmd: "getQueueStatistics",
  subscribeToAgentEventsCmd: "subscribeToAgentEvents",
  getAgentStatesCmd: "getAgentStates",
  getConfigCmd: "getConfig",
  getIceConfigCmd: "getIceConfig",
  getListCmd: "getList",
  getAgentDirectoryCmd: "getAgentDirectory",
  setAgentQueueCmd: "setAgentQueue",
  removeAgentFromQueueCmd: "removeAgentFromQueue",
  moveAgentsInGroupCmd: "moveAgentsInGroup",
  addAgentsInGroupCmd: "addAgentsInGroup",
  removeAgentGroupFromQueueGroupCmd: "removeAgentGroupFromQueueGroup",
  addAgentsNotInQueueFromGroupToCmd: "addAgentsNotInQueueFromGroupTo",
  monitorPause: "monitorPause",
  monitorUnpause: "monitorUnpause",
  inviteConferenceRoom: "inviteConferenceRoom",
  naFwd: "naFwd",
  uncFwd: "uncFwd",
  busyFwd: "busyFwd",
  getAgentCallHistoryCmd: "getAgentCallHistory",
  getUserCallHistoryCmd: "getUserCallHistory",
  getUserCallHistoryByDaysCmd: "getUserCallHistoryByDays",
  getQueueCallHistoryCmd: "getQueueCallHistory",
  findCustomerCallHistoryCmd: "findCustomerCallHistory",
  setAgentGroupCmd: "setAgentGroup",
  directoryLookUpCmd: "directoryLookUp",
  searchContactsCmd: "searchContacts",
  getFavoritesCmd: "getFavorites",
  getFavoriteContactsCmd: "getFavoriteContacts",
  addFavoriteCmd: "addFavorite",
  removeFavoriteCmd: "removeFavorite",
  setDataCmd: "setData",
  getCurrentCallsPhoneEvents: "getCurrentCallsPhoneEvents",
  flashTextBrowserRequest: "flashTextBrowserRequest",
  sendDtmf: "sendDtmf",
  subscribeToPhoneHints: "subscribeToPhoneHints",
  unsubscribeFromAllPhoneHints: "unsubscribeFromAllPhoneHints",
  retrieveQueueCall: "retrieveQueueCall",
  toggleUniqueAccountDevice: "toggleUniqueAccountDevice",
  displayNameLookup: "displayNameLookup",
  dialByUsername: "dialByUsername",
  pushLogToServer: "pushLogToServer",
  videoEvent: "videoEvent",
  subscribeToVideoStatus: "subscribeToVideoStatus",
  unsubscribeFromAllVideoStatus: "unsubscribeFromAllVideoStatus",
  inviteToMeetingRoomCmd: "inviteToMeetingRoom",
  meetingRoomInviteAckCmd: "meetingRoomInviteAck",
  meetingRoomInviteAcceptCmd: "meetingRoomInviteAccept",
  meetingRoomInviteRejectCmd: "meetingRoomInviteReject",
  setUserPreference: "setUserPreference",
  unregisterMobileApp: "unregisterMobileApp",


  createFlashTextRequest: function (requestType, to, seq, message) {
    let m = this.createMessage(this.flashTextBrowserRequest);
    m.request = requestType;
    m.sequence = seq;
    m.to = {"username": to};
    if (message) m.message = message;
    return m;
  },

  createAgentLogin: function (agentPhoneNumber, agentid) {
    let message = this.createMessage(this.agentLoginCmd);
    message.agentphonenumber = agentPhoneNumber;
    return this._createAgentMessage(message, agentid);
  },
  createAgentLogout: function (agentid) {
    return this._createAgentMessage(this.createMessage(this.agentLogoutCmd), agentid);
  },
  createPauseAgent: function (agentid, reason) {
    let message = this._createAgentMessage(this.createMessage(this.pauseAgentCmd), agentid);
    if (typeof (reason) !== 'undefined') {
      message.reason = reason;
    }
    return message;
  },
  createUnpauseAgent: function (agentid) {
    return this._createAgentMessage(this.createMessage(this.unpauseAgentCmd), agentid);
  },
  _createAgentMessage: function (message, agentid) {
    message.agentid = agentid;
    return message;
  },
  createUserStatusUpdate: function (status) {
    let message = this.createMessage(this.userStatusUpdateCmd);
    message.status = status;
    return message;
  },
  createDnd: function (state) {
    let message = this.createMessage(this.dndCmd);
    message.state = state;
    return message;
  },
  createDial: function (destination, variables) {
    let msg = this.createDestinationMessage(this.dialCmd, destination);
    msg.variables = variables;
    return msg;
  },
  createDialMobile: function (destination, variables) {
    let msg = this.createDestinationMessage(this.dialFromMobileCmd, destination);
    msg.variables = variables;
    return msg;
  },
  createDialFromQueue: function (destination, queueId, callerIdName, callerIdNumber, variables) {
    let msg = this.createDestinationMessage(this.dialFromQueueCmd, destination);
    msg.queueId = parseInt(queueId);
    msg.callerIdName = callerIdName;
    msg.callerIdNumber = callerIdNumber;
    msg.variables = variables;
    return msg;
  },
  createDialByUsername: function (username, variables) {
    let msg = this.createMessage(this.dialByUsernameCmd);
    msg.username = username;
    msg.variables = variables;
    return msg;
  },
  createOriginate: function (destination) {
    return this.createDestinationMessage(this.originateCmd, destination);
  },
  createHangup: function (uniqueId) {
    if (uniqueId) return this.createMessageFromArgs(this.hangupCmd, {uniqueId: uniqueId});
    else return this.createMessage(this.hangupCmd);
  },
  createAnswer: function (uniqueId) {
    if (uniqueId) return this.createMessageFromArgs(this.answerCmd, {uniqueId: uniqueId});
    return this.createMessage(this.answerCmd);
  },
  createHold: function (uniqueId) {
    if (uniqueId) return this.createMessageFromArgs(this.holdCmd, {uniqueId: uniqueId});
    return this.createMessage(this.holdCmd);
  },
  createDirectTransfer: function (destination) {
    return this.createDestinationMessage(this.directTransferCmd, destination);
  },
  createAttendedTransfer: function (destination, device) {
    let msg = this.createDestinationMessage(this.attendedTransferCmd, destination, device);
    msg.device = device;
    return msg;
  },
  createCompleteTransfer: function () {
    return this.createMessage(this.completeTransferCmd);
  },
  createCancelTransfer: function () {
    return this.createMessage(this.cancelTransferCmd);
  },

  createToggleMicrophone: function (call) {
    let msg = this.createToggleMicrophoneMessage(this.toggleMicrophoneCmd, call);
    return msg;
  },

  createConference: function () {
    return this.createMessage(this.conferenceCmd);
  },
  createConferenceInvite: function (numConf, exten, role, earlyJoin, variables, marked, leaveWhenLastMarkedLeave, callerId) {
    let message = this.createMessage(this.conferenceInviteCmd);
    message.numConf = numConf;
    message.exten = exten;
    message.role = role;
    message.earlyJoin = earlyJoin;
    message.variables = variables;
    message.marked = marked;
    message.leaveWhenLastMarkedLeave = leaveWhenLastMarkedLeave;
    message.callerId = callerId
    return message;
  },
  createConferenceMute: function (numConf, index) {
    let message = this.createMessage(this.conferenceMuteCmd);
    message.numConf = numConf;
    message.index = index;
    return message;
  },
  createConferenceUnmute: function (numConf, index) {
    let message = this.createMessage(this.conferenceUnmuteCmd);
    message.numConf = numConf;
    message.index = index;
    return message;
  },
  createConferenceMuteAll: function (numConf) {
    let message = this.createMessage(this.conferenceMuteAllCmd);
    message.numConf = numConf;
    return message;
  },
  createConferenceUnmuteAll: function (numConf) {
    let message = this.createMessage(this.conferenceUnmuteAllCmd);
    message.numConf = numConf;
    return message;
  },
  createConferenceMuteMe: function (numConf) {
    let message = this.createMessage(this.conferenceMuteMeCmd);
    message.numConf = numConf;
    return message;
  },
  createConferenceUnmuteMe: function (numConf) {
    let message = this.createMessage(this.conferenceUnmuteMeCmd);
    message.numConf = numConf;
    return message;
  },
  createConferenceKick: function (numConf, index) {
    let message = this.createMessage(this.conferenceKickCmd);
    message.numConf = numConf;
    message.index = index;
    return message;
  },
  createConferenceDeafen: function (numConf, index) {
    let message = this.createMessage(this.conferenceDeafenCmd);
    message.numConf = numConf;
    message.index = index;
    return message;
  },
  createConferenceUndeafen: function (numConf, index) {
    let message = this.createMessage(this.conferenceUndeafenCmd);
    message.numConf = numConf;
    message.index = index;
    return message;
  },
  createConferenceReset: function (numConf) {
    let message = this.createMessage(this.conferenceResetCmd);
    message.numConf = numConf;
    return message;
  },
  createIncludeToConference: function (role, marked, leaveWhenLastMarkedLeave, callerId) {
    let message = this.createMessage(this.includeToConferenceCmd);
    message.role = role;
    message.marked = marked;
    message.leaveWhenLastMarkedLeave = leaveWhenLastMarkedLeave;
    message.callerId = callerId
    return message;
  },
  createConferenceClose: function (numConf) {
    let message = this.createMessage(this.conferenceCloseCmd);
    message.numConf = numConf;
    return message;
  },
  createSubscribeToAgentStats: function () {
    return this.createMessage(this.subscribeToAgentStatsCmd);
  },
  createSubscribeToQueueStats: function () {
    return this.createMessage(this.subscribeToQueueStatsCmd);
  },
  createSubscribeToQueueCalls: function (queueId) {
    let message = this.createMessage(this.subscribeToQueueCallsCmd);
    message.queueId = queueId;
    return message;
  },
  createUnSubscribeToQueueCalls: function (queueId) {
    let message = this.createMessage(this.unSubscribeToQueueCallsCmd);
    message.queueId = queueId;
    return message;
  },
  createGetQueueStatistics: function (queueId, window, xqos) {
    let message = this.createMessage(this.getQueueStatisticsCmd);
    message.queueId = queueId;
    message.window = window;
    message.xqos = xqos;
    return message;
  },
  createSubscribeToAgentEvents: function () {
    return this.createMessage(this.subscribeToAgentEventsCmd);
  },
  createGetAgentStates: function () {
    return this.createMessage(this.getAgentStatesCmd);
  },
  createGetConfig: function (objectType) {
    let msg = this.createMessage(this.getConfigCmd);
    msg.objectType = objectType;
    return msg;
  },
  createGetIceConfig: function () {
    return this.createMessage(this.getIceConfigCmd);
  },
  createGetList: function (objectType) {
    let msg = this.createMessage(this.getListCmd);
    msg.objectType = objectType;
    return msg;
  },
  createSetAgentQueue: function (agentId, queueId, penalty) {
    let msg = this.createMessage(this.setAgentQueueCmd);
    msg.agentId = agentId;
    msg.queueId = queueId;
    msg.penalty = penalty;
    return msg;
  },
  createRemoveAgentFromQueue: function (agentId, queueId) {
    let msg = this.createMessage(this.removeAgentFromQueueCmd);
    msg.agentId = agentId;
    msg.queueId = queueId;
    return msg;
  },
  createGetAgentDirectory: function (objectType) {
    return this.createMessage(this.getAgentDirectoryCmd);
  },
  createPing: function () {
    let message = {};
    message.claz = this.pingClaz;
    return message;
  },
  createInviteConferenceRoom: function (userId) {
    return this.createMessageFromArgs(this.inviteConferenceRoom, {userId: userId});
  },
  createSetAgentGroup: function (agentId, groupId) {
    let msg = this.createMessage(this.setAgentGroupCmd);
    msg.agentId = agentId;
    msg.groupId = groupId;
    return msg;
  },
  createDirectoryLookUp: function (term) {
    let msg = this.createMessage(this.directoryLookUpCmd);
    msg.term = term;
    return msg;
  },
  createSearchContacts: function (term) {
    let msg = this.createMessage(this.searchContactsCmd);
    msg.term = term;
    return msg;
  },
  createGetFavorites: function () {
    let msg = this.createMessage(this.getFavoritesCmd);
    return msg;
  },
  createGetFavoriteContacts: function (term) {
    let msg = this.createMessage(this.getFavoriteContactsCmd);
    msg.term = term;
    return msg;
  },
  createAddFavorite: function (contactId, source) {
    let msg = this.createMessage(this.addFavoriteCmd);
    msg.contactId = contactId;
    msg.source = source;
    return msg;
  },
  createRemoveFavorite: function (contactId, source) {
    let msg = this.createMessage(this.removeFavoriteCmd);
    msg.contactId = contactId;
    msg.source = source;
    return msg;
  },
  createGetCurrentCallsPhoneEvents: function () {
    let msg = this.createMessage(this.getCurrentCallsPhoneEvents);
    return msg;
  },
  createDestinationMessage: function (command, destination) {
    let message = this.createMessage(command);
    message.destination = destination;
    return message;
  },
  createToggleMicrophoneMessage: function (command, uniqueId) {
    let message = this.createMessage(command);
    message.uniqueId = uniqueId;
    return message;
  },
  createMessageFromArgs: function (command, args) {
    let msg = this.createMessage(command);
    for (let arg in args) {
      msg[arg] = args[arg];
    }
    return msg;
  },
  createInviteToMeetingRoom: function (requestId, token, username) {
    let msg = this.createMessage(this.inviteToMeetingRoomCmd);
    msg.requestId = requestId;
    msg.token = token;
    msg.username = username;
    return msg;
  },
  createMeetingRoomInviteAck: function (requestId, username) {
    let msg = this.createMessage(this.meetingRoomInviteAckCmd);
    msg.requestId = requestId;
    msg.username = username;
    return msg;
  },
  createMeetingRoomInviteAccept: function (requestId, username) {
    let msg = this.createMessage(this.meetingRoomInviteAcceptCmd);
    msg.requestId = requestId;
    msg.username = username;
    return msg;
  },
  createMeetingRoomInviteReject: function (requestId, username) {
    let msg = this.createMessage(this.meetingRoomInviteRejectCmd);
    msg.requestId = requestId;
    msg.username = username;
    return msg;
  },
  createMessage: function (command) {
    let message = {};
    message.claz = this.messageClaz;
    message.command = command;
    return message;
  }
};

Cti.WebSocket = (function () {
  let socketState = {};
  let missed_heartbeats = 0;
  let pingInterval = 5000;
  let heartbeat_interval = null;
  let heartbeat_msg = JSON.stringify(Cti.WebsocketMessageFactory.createPing());


  let setSocketHandlers = function (socket) {
    socket.onopen = function () {
      socketState.status = "opened";
      Cti.Topic(Cti.MessageType.LINKSTATUSUPDATE).publish(socketState);
      if (heartbeat_interval === null) {
        missed_heartbeats = 0;
        heartbeat_interval = setInterval(function () {
          try {
            console.log("ms :" + missed_heartbeats);
            if (missed_heartbeats >= 3)
              throw new Error("Too many missed heartbeats.");
            socket.send(heartbeat_msg);
            missed_heartbeats++;
          } catch (e) {
            clearInterval(heartbeat_interval);
            heartbeat_interval = null;
            console.warn("Closing connection. Reason: " + e.message);
            socket.close();
            socket.onclose();
            socket.onclose = function () {
            };
          }
        }, pingInterval);
      }
    };

    socket.onclose = function () {
      if (heartbeat_interval !== null) {
        clearInterval(heartbeat_interval);
        heartbeat_interval = null;
      }
      socketState.status = "closed";
      Cti.Topic(Cti.MessageType.LINKSTATUSUPDATE).publish(socketState);
    };

    socket.onerror = function (error) {
      console.warn('ERROR: Error detected: ' + JSON.stringify(error));
    };

    socket.onmessage = function (event) {
      missed_heartbeats = 0;
      Cti.receive(event);
    };

        socket.sendCallback = function(message) {
            var jsonMessage = JSON.stringify(message);
            if (Cti.debugMsg) {
                console.log("S>>> " + jsonMessage);
            }
            socket.send(jsonMessage);
        };
    };

    return {
        init : function(wsurl, username, phoneNumber, WSClass) {
            var WS = WSClass || (window.MozWebSocket ? MozWebSocket : WebSocket);
            var ctiChannelSocket = new WS(wsurl);
            setSocketHandlers(ctiChannelSocket);
            Cti.init(username, phoneNumber, ctiChannelSocket);
        }
    };
})();
