var xc_webrtc = function() {
  'use strict';

  const stackState = {
    NOT_INITIALIZED: "NotInitialized",
    INITIALIZING: "Initializing",
    WAITING_FOR_SIP: "WaitingForSip",
    WAITING_FOR_ICE: "WaitingForIce",
    STARTING: "Starting",
    STARTED: "Started",
    STOPPED: "Stopped"
  };

  var registerExp = 60;
  var regTimeoutStep = 20;
  var regMaxTimeout = 60;
  var autoAnswerHeaderName = "Alert-Info";
  var autoAnswerHeaderValue = "xivo-autoanswer";
  var logger = undefined;
  var debugSIPml5 = 'error';
  var debugEvent = false;
  var debugHandler = false;

  var initPromises = [];
  var sipConf = null;
  var sipStack = null;
  var sipStackConf = null;
  var sipStackStatus = stackState.NOT_INITIALIZED;
  var wsIp;
  var wsPort;
  var wsPath;
  var wsProto;
  var wsToken;
  var registerSession = null;
  var registerTimeout = 0;
  var username;
  var callSessions = [];
  var remoteAudioIdRoot;
  var callConfig;
  var iceServers;
  var iceRenewal;

  var audioContext;
  var deviceConference = {enabled: false, sessionHost: undefined};
  var remoteStreamHandlers = {};
  var localStreamHandlers = {};
  var ctiApi = window.Cti;
  var sipmlApi = window.SIPml;

  function init(name, ssl, websocketPort, token, remoteAudio, ip) {
    preConfig(name, ssl, websocketPort, remoteAudio, ip, token);
    ctiApi.setHandler(Cti.MessageType.LINECONFIG, processLineCfg);
    ctiApi.getConfig('line');
  }

  function initByLineConfig(lineCfg, name, ssl, websocketPort, token, remoteAudio, ip) {
    preConfig(name, ssl, websocketPort, remoteAudio, ip, token);
    ctiApi.setHandler(Cti.MessageType.LINECONFIG, processLineCfg);
    return initStack(lineCfg, username);
  }

  function setCustomLogger(customLogger) {
    if (hasRequiredMethods(customLogger)) {
      logger = customLogger;
    } else logger.error("Custom logger needs to implement at least the following methods to be valid: log, info, warn, error")
  }

  function hasRequiredMethods(logger) {
    return (typeof logger.info === "function" 
    && typeof logger.error === "function"
    && typeof logger.warn === "function"
    && typeof logger.log === "function")
  }

  function getSipStackStatus() {
    return sipStackStatus;
  }

  function initStack(lineCfg, username) {

    var sipReadyCallback = function(){
      sipStackStatus = stackState.WAITING_FOR_ICE;
      initPromises[0].resolve();
    };

    var sipErrorCallback = function(e){
      console.error('Failed to initialize the engine: ' + e.message);
      initPromises[0].reject(e.message);
    };

    if (sipStackStatus == stackState.NOT_INITIALIZED) {
      sipStackStatus = stackState.INITIALIZING;

      let iceConfigPromise = new Promise((resolve, reject) => {
        initPromises.push({resolve: resolve, reject: reject});
      });

      let sipReadyPromise = new Promise((resolve, reject) => {
        initPromises.push({resolve: resolve, reject: reject});
      });

      updateSipConf(lineCfg, username);

      ctiApi.setHandler(Cti.MessageType.ICECONFIG, processIceCfg);
      ctiApi.getIceConfig();

      setSipDebug(debugSIPml5);
      if (logger != undefined) sipmlApi.setCustomLogger(logger);

      sipmlApi.init(sipReadyCallback, sipErrorCallback);

      return Promise.all(initPromises).then(() => {
        startNewStack(sipConf);
      }).catch((e) => {
        console.error("SIPml can't be initialized nor get Ice candidates and therefore can't start stack", e);
        sipStackStatus = stackState.NOT_INITIALIZED;
      });
    }
    return Promise.resolve("SipMl is already initialized - Skipping");
  }

  function stop() {
    sipStackStatus = stackState.STOPPED;
    clearInterval(iceRenewal);

    callSessions.forEach(function(call) {
      call.session.removeEventListener('*');
    });

    callSessions.size = 0;
    if (registerSession !== null) {
      registerSession.removeEventListener('*');
      registerSession = null;
    }

    if (sipStack !== null) {
      sipStack.removeEventListener('*');
      sipStack.stop();
      sipStack = null;
      ctiApi.unsetHandler(Cti.MessageType.WEBRTCCMD, processCtiCommand);
    }
  }

  function preConfig(name, ssl, websocketPort, remoteAudio, ip, token) {
    remoteAudioIdRoot = typeof remoteAudio !== 'undefined' ?  remoteAudio : "audio_remote";
    if (ip) { wsIp = ip; }
    username = name;
    wsProto = ssl ? 'wss://' : 'ws://';
    wsPort = websocketPort;
    wsPath = ssl ? 'wssip' : 'ws';
    wsToken = token
  }

  function disableICE() {
    iceServers = [];
    iceServers.toString = function() {
      return "workaround bug https://code.google.com/p/sipml5/issues/detail?id=187";
    };
    console.log("Disable ICE");
  }

  function setIceUrls(urls) {
    iceServers = urls;
    console.log("Set ICE urls: ", urls);
  }

  function getIceUrls() {
    return iceServers;
  }

  function processLineCfg(lineCfg) {
    ctiApi.unsetHandler(Cti.MessageType.LINECONFIG, processLineCfg);

    switch(sipStackStatus) {
      case stackState.NOT_INITIALIZED:
      case stackState.WAITING_FOR_SIP:
        initStack(lineCfg, username);
        sipStackStatus = stackState.WAITING_FOR_ICE;
        break;
      case stackState.STOPPED:
        ctiApi.setHandler(Cti.MessageType.ICECONFIG, processIceCfg);
        ctiApi.getIceConfig();
        updateSipConf(lineCfg, username);
        startNewStack(sipConf);
        break;
      case stackState.STARTED:
      case stackState.STARTING:
      case stackState.INITIALIZING:
        console.warn(`LineConfig update has been received during stack state ${sipStackStatus} and so has been discarded`, lineCfg);
        break;
    };
  }

  function renewIceConf(ttl) {
    clearInterval(iceRenewal);
    iceRenewal = setInterval(function() {
      console.log("Renew Ice turn credentials before it expires");
      ctiApi.setHandler(Cti.MessageType.ICECONFIG, processIceCfg);
      ctiApi.getIceConfig();
    }, Math.trunc(ttl / 2) * 1000);
  }

  function updateIceServers(iceCfg) {
    let stunConfig = iceCfg.stunConfig;
    let turnConfig = iceCfg.turnConfig;
    let data = [];

    [stunConfig, turnConfig]
      .filter(c => c !== undefined)
      .map(({ ttl, ...c }) => c)
      .forEach(c => data.push(c));

    if (data.length > 0) {
      setIceUrls(data);
      if (turnConfig) {
        let iceTurnTTL = turnConfig.ttl;
        console.debug(`Ice turn credentials will be renewed in the next ${Math.trunc(iceTurnTTL / 2)} seconds`);
        renewIceConf(iceTurnTTL);
      }
    } else disableICE();
  }

  function processIceCfg(iceCfg) {
    ctiApi.unsetHandler(Cti.MessageType.ICECONFIG, processIceCfg);
    updateIceServers(iceCfg);

    switch(sipStackStatus) {
      case stackState.NOT_INITIALIZED:
      case stackState.INITIALIZING:
      case stackState.WAITING_FOR_ICE:
        initPromises[1].resolve();
        sipStackStatus = stackState.WAITING_FOR_SIP;
        break;
      case stackState.STARTING:
      case stackState.STARTED:
        let s = sipStackConf;
        s.ice_servers = getIceUrls();
        sipStack.setConfiguration(s);
        break;
      case stackState.STOPPED:
        console.warn("Sip stack is stopped, IceConfig has been discarded", iceCfg);
        break;
    };
  }

  function setWsServer(wsproto, wsIp, wsPort, sipProxyName, wsToken, wsPath) {
    let wsServer = `${wsProto}${wsIp}:${wsPort}/${wsPath}`;
    if (typeof(sipProxyName) != 'undefined' && sipProxyName !== '' && sipProxyName !== 'default') {
      wsServer += `-${sipProxyName}`;
    }
    wsServer += `?token=${wsToken}`;
    return wsServer;
  }

  function updateSipConf(lineCfg, name) {
    if (typeof lineCfg.password !== 'string') {
      throw new Error('Unable to configure WebRTC - LineConfig does not contains password');
    }

    wsIp = typeof wsIp !== 'undefined' ? wsIp : lineCfg.xivoIp;
    let appVersion = window.appVersion || 'Unknown version';
    sipConf = {
      sip: {
        authorizationUser : lineCfg.name,
        realm: lineCfg.sipPort ? lineCfg.sipProxyName + ':' + lineCfg.sipPort : lineCfg.sipProxyName,
        domain: lineCfg.sipProxyName,
        password : lineCfg.password,
        wsServer : setWsServer(wsProto, wsIp, wsPort, lineCfg.sipProxyName, wsToken, wsPath),
        displayName: name,
        registerExpires: registerExp,
        sip_headers: [
          { name: 'User-Agent', value: 'XiVO XC WebRTC ' + appVersion }
        ]
      }
    };
  }

  function toggleMicrophone (sipCallId) {
    if (callSessions.length == 0) {
      console.warn("Cannot mute user : no active calls");
      return;
    }
    let userCall = callSessions.filter(function(callSession) {
      return callSession.sipCallId === sipCallId;
    });
    if (userCall.length == 0) {
      if (typeof sipCallId !== 'undefined') {
        console.warn("Cannot mute user : call with given id not found");
        return;
      }
      userCall.push(callSessions[0]);
    }
    let localStreams = userCall[0].session.o_session.get_stream_local();
    if (localStreams == undefined){
      console.warn("Cannot mute user : no stream found");
      return;
    }
    localStreams.getTracks().forEach(track => {
      track.enabled == true ? track.enabled = false : track.enabled = true;
    });
  }

  function processCtiCommand(msg) {
    console.debug("Got a cti command:", msg);
    switch(msg.command) {
    case "Answer":
      answerBySipCallId(msg.sipCallId);
      break;
    case  "Hold":
      holdBySipCallId(msg.sipCallId);
      break;
    case "SendDtmf":
      dtmf(msg.key);
      break;
    case "ToggleMicrophone":
      toggleMicrophone(msg.sipCallId);
      break;
    default:
      console.log("Cti command not implemented: ", msg.command);
    }
  }

  function setDebug(sipml5level, event, handler) {
    setSipDebug(sipml5level);
    debugEvent = event;
    debugHandler = handler;
  }

  function setSipDebug(level) {
    console.log('Setting SIPml5 debug to ', level);
    sipmlApi.setDebugLevel(level);
  }

  function isStackAvailable() {
    return (sipmlApi.isInitialized() &&
     (sipStackStatus == stackState.STARTING || sipStackStatus == stackState.STARTED))
  }

  function replaceUnderscores(string) {
    if (typeof string == "string") {
      if (string.includes("_")) return string.replace(/\_/g, "-");
    }
    return string;
  }

  function startNewStack(conf) {
    sipStackStatus = stackState.STARTING;

    if (!isStackAvailable()) {
      console.error("SIPml is not initialized nor ready and therefore stack can't be started");
      sipStackStatus = stackState.NOT_INITIALIZED;
      return;
    } else {
      console.info("SIPml is initialized - starting new stack");
      ctiApi.unsetHandler(Cti.MessageType.WEBRTCCMD, processCtiCommand);

      conf.sip.domain = replaceUnderscores(conf.sip.domain);
      conf.sip.realm = replaceUnderscores(conf.sip.realm);

      sipStackConf = {
        /*jshint camelcase: false */
        realm: conf.sip.realm,
        impi: conf.sip.authorizationUser,
        impu: 'sip:' + conf.sip.authorizationUser + '@' + conf.sip.domain,
        password: conf.sip.password,
        display_name: conf.sip.displayName,
        websocket_proxy_url: conf.sip.wsServer,
        enable_rtcweb_breaker: false,
        events_listener: { events: '*', listener: generalEventListener },
        ice_servers: iceServers,
        sip_headers: conf.sip.sip_headers,
      };
      sipStack = new sipmlApi.Stack(sipStackConf);
      delete sipStackConf.sip_headers;

      sipStack.start();
      ctiApi.setHandler(Cti.MessageType.WEBRTCCMD, processCtiCommand);
    }
  }

  function register() {
    if (sipStack === null) {
      console.info("sipStack is stopped, aborting registration");
      return;
    }

    registerSession = sipStack.newSession('register', {
      expires: sipConf.sip.registerExpires,
      /*jshint camelcase: false */
      events_listener: { events: '*', listener: registerEventListener },
    });
    registerSession.register();
  }

  function topic(id) {
    if (typeof (jQuery) !== "undefined") {
      var callbacks, topic = id && Cti.ctiTopics[id];
      if (!topic) {
        callbacks = jQuery.Callbacks();
        topic = {
          publish: callbacks.fire,
          subscribe: callbacks.add,
          unsubscribe: callbacks.remove,
          clear: callbacks.empty
        };
        if (id) {
          Cti.ctiTopics[id] = topic;
        }
      }
      return topic;
    } else if (typeof (SHOTGUN) !== "undefined") {
      return {
        clear : function(){
          try{
            SHOTGUN.remove('xc_webrtc');
          }catch(e){}
        },
        publish : function(val){
          SHOTGUN.fire('xc_webrtc/'+id,[val]);
        },
        subscribe : function(handler){
          SHOTGUN.listen('xc_webrtc/'+id,handler);
        },
        unsubscribe : function(handler){
          SHOTGUN.remove('xc_webrtc/'+id,handler);
        }
      };
    } else {
      console.log("No callback handler available ! Neither jQuery nor SHOTGUN is available.");
    }
  }

  function setHandler(eventName, handler) {
    topic(eventName).subscribe(handler);
    if (debugHandler) {
      console.log("subscribing : [" + eventName + "] to " + handler);
    }
    return function() {_unsetHandler(eventName, handler); };
  }

  function _unsetHandler(eventName, handler) {
    topic(eventName).unsubscribe(handler);
    if (debugHandler) {
      console.log("unsubscribing : [" + eventName + "] to " + handler);
    }
  }

  function clearHandlers() {
    topic().clear();
  }

  function generalEventListener(e) {
    if (debugEvent){ console.log("RE<<< ", e); }
    processGeneralEvent(e);
  }

  function registerEventListener(e) {
    if (debugEvent){ console.log("RE<<< ", e); }
    processRegisterEvent(e);
  }
  function sessionEventListener(e) {
    if (debugEvent){ console.log("RE<<< ", e); }
    processSessionEvent(e);
  }

  function publishEvent(id, event, data, sipCallId) {
    if (sipStack === null) {
      if (ctiApi.debugMsg){
        console.info('Event not published because there is no SIP stack:', id, event, data);
      }
      return;
    }
    try{
      console.debug('Publishing event ', event, data, sipCallId);
      topic(id).publish(createEvent(event, data, sipCallId));
    }catch(error){
      if (ctiApi.debugMsg){
        console.error(id,event,error);
      }
    }
  }

  /**
  * Get the remote peer media stream using a session id.
  * @param {Number} id The session id to retrieve the correct media stream
  * @return {MediaStream} The media stream of the remote peer containing audio or video `MediaStreamTracks`
  */

  function getRemoteStream(id) { return getSessionById(id)[0].session.o_session.get_stream_remote(); }

  /**
  * Get the local user media stream using a session id.
  * @param {Number} id The session id to retrieve the correct media stream
  * @return {MediaStream} The media stream of the local user containing audio or video `MediaStreamTracks`
  */

  function getLocalStream(id) { return getSessionById(id)[0].session.o_session.get_stream_local(); }

  /**
  * Send the remote peer `MediaStream` in the remote stream `callback` which matches a session sipcallid.
  * @param {Number} id The session id to retrieve the correct media stream
  */

  function publishRemoteStream(id) {
    var session = getSessionById(id)[0];
    if (session.sipCallId in remoteStreamHandlers) {
        remoteStreamHandlers[session.sipCallId].forEach((handlerCallback) => { handlerCallback(getRemoteStream(id)); });
    }
  }

  /**
  * Send the local user `MediaStream` in the local stream `callback` which matches a session sipcallid.
  * @param {Number} id The session id to retrieve the correct media stream
  */

  function publishLocalStream(id) {
    var session = getSessionById(id)[0];
    if (session.sipCallId in localStreamHandlers) {
        localStreamHandlers[session.sipCallId].forEach((handlerCallback) => { handlerCallback(getLocalStream(id)); });
    }
  }

  /**
   * Get the current WebRTC connection inbetween the local host and the remote peer from Sipml
   * @return {RTCPeerConnection} A WebRTC peer connection
   */

  function getCurrentRTCPeerConnection(sipCallId) {
    let callSession = getSessionBySipCallId(sipCallId)[0];
    return callSession.session.o_session.media.RTCPeerConnection;
  }

  function createEvent(eventType, data, sipCallId) {
    if (typeof data === 'undefined' || data === null) {
        if (typeof sipCallId === 'undefined' || sipCallId === null) {
          return {'type': eventType};
        }
        else {
          return {'type': eventType, 'sipCallId': sipCallId};
        }

    }
    else {
      if (typeof sipCallId === 'undefined' || sipCallId === null) {
          return {'type': eventType, 'data': data};
      }
      else {
        return {'type': eventType, 'data': data, 'sipCallId': sipCallId};
      }
    }
  }

  function processGeneralEvent(e) {
    switch(e.type) {
    case 'starting': {
      callSessions = [];
      break;
    }
    case 'started': {
      sipStackStatus = stackState.STARTED;
      publishEvent(xc_webrtc.MessageType.GENERAL, xc_webrtc.General.STARTED);
      console.log('Started, registering');
      register();
      break;
    }
    case 'failed_to_start': {
      publishEvent(xc_webrtc.MessageType.GENERAL, xc_webrtc.General.FAILED, {'reason': e.description});
      break;
    }
    case 'i_new_call': {
      publishEvent(xc_webrtc.MessageType.INCOMING, xc_webrtc.Incoming.SETUP, getCaller(e));
      e.newSession.addEventListener('*', sessionEventListener);
      insertSession(e, xc_webrtc.Incoming.SETUP);
      processAutoAnswer(e.o_event.o_message.ao_headers, e.newSession.getId(), getCaller(e));
      console.log('Incoming call');
      break;
    }
    }
  }

  function insertSession(event, state) {
    callSessions.push({
      id: event.newSession.getId(),
      session: event.newSession,
      state: state,
      sipCallId: getSipCallId(event),
      local_destination: getAudioContext().createMediaStreamDestination(),
      audioLocalSource: null,
      audioRemoteSource: null
    });
  }

  function getSipCallId(event) {
    return event.o_event.o_message.o_hdr_Call_ID.s_value;
  }

  function getSessionById(id) {
    return callSessions.filter(function(session) {
      return session.id === id;
    });
  }

  function getSessionBySipCallId(id) {
    return callSessions.filter(function(session) {
      return session.sipCallId === id;
    });
  }

  function getCallsInState(state) {
    return callSessions.filter(function(session) {
      return session.state === state;
    });
  }

  function getConnectedCalls() {
    if (xc_webrtc.Incoming.CONNECTED === xc_webrtc.Outgoing.CONNECTED) {
      return getCallsInState(xc_webrtc.Incoming.CONNECTED);
    }
    else {
      return getCallsInState(xc_webrtc.Incoming.CONNECTED)
        .concat(getCallsInState(xc_webrtc.Outgoing.CONNECTED));
    }
  }

  function allButWithId(id) {
    return callSessions.filter(function(session) {
      return session.id !== id;
    });
  }

  function allButOnConnected() {
    return callSessions.filter(function (session) {
      return (session.state !== xc_webrtc.Incoming.CONNECTED || session.state !== xc_webrtc.Outgoing.CONNECTED);
    });
  }

  function updateSession(sessionId, state, sipCallId) {
    var call = getSessionById(sessionId)[0];
    if (call) {
      var updatedSession = call;
      updatedSession.state = state;
      if (typeof sipCallId !== 'undefined' && sipCallId !== null) {
        updatedSession.sipCallId = sipCallId;
      }
      pushUpdatedSession(updatedSession);
    }
  }

  function pushUpdatedSession(updatedSession) {
    var index = -1;
    callSessions.some(function(item, currentIndex) { if(item.id === updatedSession.id) { index = currentIndex; } });
    if (index>=0) {
      callSessions.splice(index, 1);
      callSessions.push(updatedSession);
    }
    else { callSessions.push(updatedSession); }
  }

  function isOnHold(session) {
    return (session.state === xc_webrtc.Incoming.HOLD || session.state === xc_webrtc.Outgoing.HOLD);
  }

  function processAutoAnswer(headers, incomingSessionId, caller) {
    if(shouldAutoAnswer(headers)) {
      console.log('XiVO auto answer header found, answering the call.');
      allButWithId(incomingSessionId).forEach(function(call, index) {
        if (!isOnHold(call)) {
          call.session.hold();
        }
      });
      answer(incomingSessionId);
      publishEvent(xc_webrtc.MessageType.INCOMING, xc_webrtc.Incoming.AUTO_ANSWERED, caller);
    }
  }

  function processHangup(sessionId) {
    var call = getSessionById(sessionId)[0];
    if (call.audioLocalSource) {
      call.audioLocalSource.disconnect();
      call.audioLocalSource = null;
    }
    if (call.audioRemoteSource) {
      call.audioRemoteSource.disconnect();
      call.audioRemoteSource = null;
    }
    callSessions = allButWithId(sessionId);
    deviceConference.enabled = false;
    deviceConference.sessionHost = undefined;
    removeAudioElem(sessionId);
  }

  function shouldAutoAnswer(headers) {
    function isAutoAnswerHeader(elem) {
      return elem.s_name===autoAnswerHeaderName && elem.s_value===autoAnswerHeaderValue;
    }
    return headers.some(isAutoAnswerHeader);
  }

  function processRegisterEvent(e) {
    switch(e.type) {
    case 'connected': {
      publishEvent(xc_webrtc.MessageType.REGISTRATION, xc_webrtc.Registration.REGISTERED);
      console.log("Registered");
      registerTimeout = 0;
      break;
    }
    case 'terminated': {
      publishEvent(xc_webrtc.MessageType.REGISTRATION, xc_webrtc.Registration.UNREGISTERED, {'reason': e.description});
      if(sipStack !== null) {
        retryRegister();
      }
      break;
    }
    }
  }

  function retryRegister() {
    console.log("Unregistered, will retry in " + registerTimeout + "s");
    setTimeout(
      function() {
        console.log("Retrying register request");
        register();
      },
      registerTimeout * 1000);

    if (registerTimeout <= regMaxTimeout - regTimeoutStep) {
      registerTimeout = registerTimeout + regTimeoutStep;
    }
  }

  function processSessionEvent(e) {
    var sipCallId = getSessionById(e.session.getId())[0].sipCallId;
    switch(e.type) {
    case 'connected': {
      if (isOutgoing(e)) {
        publishEvent(xc_webrtc.MessageType.OUTGOING, xc_webrtc.Outgoing.CONNECTED, getCallee(e), sipCallId);
        updateSession(e.session.getId(), xc_webrtc.Outgoing.CONNECTED);
      } else {
        publishEvent(xc_webrtc.MessageType.INCOMING, xc_webrtc.Incoming.CONNECTED, getCaller(e), sipCallId);
        updateSession(e.session.getId(), xc_webrtc.Incoming.CONNECTED);
      }
      updateElements(e.session);
      console.log('Connected');
      break;
    }
    case 'm_stream_audio_remote_added': {
      connectRemoteStreamWithCall(e.session.getId());
      publishRemoteStream(e.session.getId());
      publishEvent(xc_webrtc.MessageType.INCOMING, xc_webrtc.Incoming.REMOTE_MEDIA_ADDED);
      break;
    }
    case 'm_stream_audio_local_added': {
      connectLocalStreamWithCall(e.session.getId());
      publishLocalStream(e.session.getId());
      break;
    }
    case 'i_ao_request':
      {
        setSipCallId(e);
        var iSipResponseCode = e.getSipResponseCode();
        if (iSipResponseCode === 180 || iSipResponseCode === 183) {
          if (isOutgoing(e)) {
            publishEvent(xc_webrtc.MessageType.OUTGOING, xc_webrtc.Outgoing.RINGING, getCallee(e), sipCallId);
            updateSession(e.session.getId(), xc_webrtc.Outgoing.RINGING);
          } else {
            publishEvent(xc_webrtc.MessageType.INCOMING, xc_webrtc.Incoming.RINGING, getCaller(e), sipCallId);
            updateSession(e.session.getId(), xc_webrtc.Incoming.RINGING);
          }
          console.log('Ringing');
        }
        break;
      }
    case 'm_local_hold_ok': {
      if (isOutgoing(e)) {
        publishEvent(xc_webrtc.MessageType.OUTGOING, xc_webrtc.Outgoing.HOLD, undefined, sipCallId);
        updateSession(e.session.getId(), xc_webrtc.Outgoing.HOLD);
      } else {
        publishEvent(xc_webrtc.MessageType.INCOMING, xc_webrtc.Incoming.HOLD, undefined, sipCallId);
        updateSession(e.session.getId(), xc_webrtc.Incoming.HOLD);
      }
      console.log('Holded');
      break;
    }
    case 'm_local_resume_ok': {
      if (isOutgoing(e)) {
        publishEvent(xc_webrtc.MessageType.OUTGOING, xc_webrtc.Outgoing.RESUME, undefined, sipCallId);
        updateSession(e.session.getId(), xc_webrtc.Outgoing.CONNECTED);
      } else {
        publishEvent(xc_webrtc.MessageType.INCOMING, xc_webrtc.Outgoing.RESUME, undefined, sipCallId);
        updateSession(e.session.getId(), xc_webrtc.Incoming.CONNECTED);
      }
      console.log('Resumed');
      break;
    }
    case 'terminating':
    case 'terminated': {
      if (isOutgoing(e)) {
        publishEvent(xc_webrtc.MessageType.OUTGOING, xc_webrtc.Outgoing.TERMINATED, {"reason": e.description}, sipCallId);
      } else {
        publishEvent(xc_webrtc.MessageType.INCOMING, xc_webrtc.Outgoing.TERMINATED, {"reason": e.description}, sipCallId);
      }
      processHangup(e.session.getId());
      console.debug('calls after hangup: ', callSessions);
      break;
    }
    }
  }

  function setSipCallId(e) {
    var call = getSessionById(e.session.getId());
    if (typeof call.sipCallId === 'undefined' || call.sipCallId === null) {
      updateSession(e.session.getId(), call.state, getSipCallId(e));
    }
  }

  function updateElements(session) {
    var cfg = getCallConfig(session.o_session.i_id);
    console.log('Update session configuration: ', cfg);
    session.setConfiguration(cfg);
  }

  function isOutgoing(e) {
    return e.o_event.o_session.o_uri_from.s_display_name === sipConf.sip.displayName;
  }

  function getCallee(e) {
    return {'callee': e.o_event.o_session.o_uri_to.s_user_name};
  }

  function getCaller(e) {
    return {'caller': e.o_event.o_session.o_uri_from.s_user_name};
  }

  function getParticipantsData(e) {
    return {'caller': e.o_session.o_uri_from.s_display_name,
            'callee': e.o_session.o_uri_to.s_user_name};
  }

  function dial(destination) {
    console.log('Dial: ', destination);
    var sessionType = 'call-audio';
    var newSession = sipStack.newSession(sessionType, {});
    newSession.setConfiguration(getCallConfig(newSession.getId()));
    if (newSession.call(destination) !== 0) {
      publishEvent(xc_webrtc.MessageType.OUTGOING, xc_webrtc.Outgoing.FAILED);
      console.log('call Failed');
      return;
    }
    else {
      publishEvent(xc_webrtc.MessageType.OUTGOING, xc_webrtc.Outgoing.ESTABLISHING);
      callSessions.push({id: newSession.getId(), session: newSession, local_destination: getAudioContext().createMediaStreamDestination() });
      console.log('call Establishing');
    }
  }

  function answer(sessionId) {
    if (sessionId) {
      console.warn('Answer with sessionId is deprecated - Please use AnswerBySipCallId instead')
      return answerBySessionId(sessionId);
    }
    else {
      return answerWithoutSessionId();
    }
  }

  function answerBySipCallId(sipCallId) {
    if (sipCallId) {
      let session = getSessionBySipCallId(sipCallId)[0];
      if (session) {
        return answerBySessionId(session.id);
      } else {
        console.error("Sip Call Id "+sipCallId+" is not found, answer action is discarded");
        return false;
      }
    }
    else {
      return answerWithoutSessionId();
    }
  }

  function holdConnectedCalls() {
    getConnectedCalls().forEach(function(session,index) {
      session.session.hold();
    });
  }

  function answerBySessionId(sessionId) {
    var call = getSessionById(sessionId)[0];
    if (call) {
      holdConnectedCalls();
      console.log('Answering call with sessionId', sessionId);
      updateElements(call.session);
      return acceptSession(call.session);
    }
    else {
      console.warn('Call not found, unable to answer, sessionId: ', sessionId);
      return false;
    }
  }

  function answerWithoutSessionId() {
    var ringingCall = getCallsInState(xc_webrtc.Incoming.SETUP)[0];
    if (ringingCall) {
      holdConnectedCalls();
      console.log('Answering call without sessionId');
      updateElements(ringingCall.session);
      return acceptSession(ringingCall.session);
    }
    else {
      console.error('Answering without session ID is not supported if there\'s more or less than one active session');
      return false;
    }
  }

  function acceptSession(session) {
    if (session.accept(getCallConfig(session.getId())) === 0) {
      return true;
    }
    else {
      console.error('Unable to answer session ', session);
      return false;
    }
  }

  /**
  * Retrieve the current webrtc `AudioContext`, or creates a new one if none is defined
  * @return {AudioContext} The current `AudioContext`
  */

  function getAudioContext() {
    if (!audioContext) {
        audioContext = new AudioContext();
    }
    return audioContext;
  }

  function conference() {
    allButOnConnected().forEach(function(call) {
        deactivateHold(call.session);
    });
    deviceConference.enabled = true;
  }

  /**
  * Retrieves the local user `MediaStream` and connect it in the call using a `MediaStreamAudioSourceNode`
  * @param {Number} id The session id to retrieve the correct call
  */

  function connectLocalStreamWithCall(id) {
    var call = getSessionById(id)[0];
    var localStream = getLocalStream(id);
    if (typeof(call.audioLocalSource) === 'undefined' || call.audioLocalSource == null){
      call.audioLocalSource = getAudioContext().createMediaStreamSource(localStream);
      call.audioLocalSource.connect(call.local_destination);
    }
  }

  /**
  * Retrieves the remote peer `MediaStream` and connect it in the call using a `MediaStreamAudioSourceNode`
  * @param {Number} id The session id to retrieve the correct call
  */

  function connectRemoteStreamWithCall(id) {
    var currentSession = getSessionById(id)[0];
    currentSession.audioRemoteSource = xc_webrtc.getAudioContext().createMediaStreamSource(getRemoteStream(id));
    if (deviceConference.enabled && (deviceConference.sessionHost == currentSession || !deviceConference.sessionHost)) {
      deviceConference.sessionHost = currentSession;
      createDeviceConference(currentSession);
    }
  }

  function createDeviceConference(currentSession) {
    let secondSession = callSessions.find(c => c.id != currentSession.id);
    currentSession.session.injectStream(xc_webrtc.createAndGetMixedTrack(currentSession, secondSession));
    secondSession.session.injectStream(xc_webrtc.createAndGetMixedTrack(secondSession, currentSession));
  }

  function createAndGetMixedTrack(baseSession, sessionToBeInjected) {
    let baseSessionTracks = baseSession.session.getTracks();
    let sessionToBeInjectedTracks = sessionToBeInjected.session.getTracks();

    let selfAudio = new MediaStream();
    selfAudio.addTrack(baseSessionTracks.local[0]);

    let remoteAudio = new MediaStream();
    remoteAudio.addTrack(sessionToBeInjectedTracks.remote[0]);

    let inputA = audioContext.createMediaStreamSource(selfAudio);
    let inputB = audioContext.createMediaStreamSource(remoteAudio);

    let mix = audioContext.createMediaStreamDestination();
    inputA.connect(mix);
    inputB.connect(mix);

    return mix.stream;
  }

  function getCallConfig(id) {
    var config = {
      /*jshint camelcase: false */
      audio_remote: getAudioElem(id),
      audio_local: new Audio(),
      events_listener: { events: '*', listener: sessionEventListener }
    };
    return config;
  }

  function getAudioElem(id) {
    var elemId = remoteAudioIdRoot + id;
    var remoteAudioElement = document.getElementById(elemId);
    if (remoteAudioElement === null || typeof remoteAudioElement === 'undefined') {
        remoteAudioElement = new Audio();
        remoteAudioElement.id = elemId;
        remoteAudioElement.autoplay = "autoplay";
        document.body.appendChild(remoteAudioElement);
    }
    return remoteAudioElement;
  }

  function removeAudioElem(id) {
    $('audio').remove('#' + remoteAudioIdRoot + id);
  }

  function setRemoteStreamHandler(handler, sipCallId) {
    if (!(sipCallId in remoteStreamHandlers)){
      remoteStreamHandlers[sipCallId] = [];
    }
    remoteStreamHandlers[sipCallId].push(handler);
    var session = callSessions[callSessions.findIndex(function(item) {return item.sipCallId === sipCallId; })];
    if (session) {
      var streamRemote = getRemoteStream(session.id);
      if (streamRemote) {
        handler(streamRemote);
      }
    }
    return function() { return _unsetRemoteStreamHandler(handler, sipCallId); };
  }

  function _unsetRemoteStreamHandler(handler, sipCallId) {
    remoteStreamHandlers[sipCallId] = remoteStreamHandlers[sipCallId].filter(function(elem) { return elem !== handler ;});
    return handler;
  }

  function setLocalStreamHandler(handler, sipCallId) {
    if (!(sipCallId in localStreamHandlers)){
      localStreamHandlers[sipCallId] = [];
    }
    localStreamHandlers[sipCallId].push(handler);
    var session = callSessions[callSessions.findIndex(function(item) {return item.sipCallId === sipCallId; })];
    if (session) {
      var streamLocal = getLocalStream(session.id);
      if (streamLocal) {
        handler(streamLocal);
      }
    }
    return function() { return _unsetLocalStreamHandler(handler, sipCallId); };
  }

  function _unsetLocalStreamHandler(handler, sipCallId) {
    localStreamHandlers[sipCallId] = localStreamHandlers[sipCallId].filter(function(elem) { return elem !== handler ;});
    return handler;
  }

  function attendedTransfer(destination) {
    var establishedCalls = getConnectedCalls();
    if (callSessions.length < 2) {
      establishedCalls.forEach(function(call,index) {
        call.session.hold();
      });
      ctiApi.attendedTransfer(destination);
    } else {
      console.warn('Already two existing call sessions, aborting attended transfer');
    }
  }

  function completeTransfer() {
    ctiApi.completeTransfer();
  }

  function dtmf(digit) {
    var establishedCalls = getConnectedCalls();
    if (establishedCalls.length < 1) {
      console.warn('We need at least one established session to send DTMF - DTMF not send.');
      return false;
    }
    if (digit.length !== 1) {
      console.warn('Expecting exactly one character - DTMF not send.');
      return false;
    }
    var res = 0;
    establishedCalls.forEach(function(call, index) {
      res += call.session.dtmf(digit);
    });
    if (res !== 0) {
      console.warn('sending DTMF failed with error ' + res);
      return false;
    }
    return true;
  }

  function hold(sessionId) {
    if (sessionId) {
      console.warn('Hold with sessionId is deprecated - Please use holdBySipCallId instead')
      return holdBySessionId(sessionId);
    }
    else if (deviceConference.enabled) {
      return holdConference();
    }
    else {
      return holdWithoutSessionId();
    }
  }

  function holdBySipCallId(sipCallId) {
    if (sipCallId) {
      let session = getSessionBySipCallId(sipCallId)[0];
      if (session) {
        return holdBySessionId(session.id);
      } else {
        console.error("Sip Call Id "+sipCallId+" is not found, hold action is discarded");
        return false;
      }
    }
    else if (deviceConference.enabled) {
      return holdConference();
    }
    else {
      return holdWithoutSessionId();
    }
  }

  function holdBySessionId(sessionId) {
    let call = getSessionById(sessionId)[0];
    if(call) {
      if (isOnHold(call)) {
        allButWithId(sessionId).forEach(function(c, index) {
          if (!isOnHold(c)) {
            c.session.hold();
          }
        });
        return deactivateHold(call.session);
      } else {
        return activateHold(call.session);
      }
    } else {
      console.error("Session Id "+sessionId+" is not found, hold action is discarded");
    }
    return false;
  }

  function holdWithoutSessionId() {
    if (callSessions.length !== 1) {
      console.error('Hold/resume without session Id is not supported if there\'s more or less than one session');
      return false;
    }
    else {
      if (callSessions[0].state === xc_webrtc.Incoming.HOLD || callSessions[0].state === xc_webrtc.Outgoing.HOLD) {
        return deactivateHold(callSessions[0].session);

      }
      else {
        return activateHold(callSessions[0].session);
      }
    }
  }

  function holdConference() {
    callSessions.forEach(function(session) {
      holdBySipCallId(session.sipCallId);
    });
  }

  function activateHold(session) {
    console.debug('Hold session', session);
    return (session.hold() === 0);
  }

  function deactivateHold(session) {
    console.debug('Resume session', session);
    return (session.resume() === 0);
  }

  function getRegisterTimeoutStep() {
    return regTimeoutStep;
  }

  function injectTestDependencies(cti, sipml) {
    ctiApi = cti;
    sipmlApi = sipml;
    callSessions = [];
    sipStackStatus = stackState.NOT_INITIALIZED;
    initPromises = [];
  }

  function getMediaTypeBySipCallId(callId) {
    var index = -1;
    callSessions.some(function(item, currentIndex) { if(item.sipCallId === callId) { index = currentIndex; } });
    if (index >=0) {
      return getSessionType(callSessions[index].session);
    }
    else {
      return null;
    }
  }

  function getSessionType(session) {
    return session.o_session.media.e_type.s_name;
  }

  function doesSessionExists(sipCallId) {
    return getSessionBySipCallId(sipCallId).length > 0;
  }

  return {
    init: init,
    initByLineConfig: initByLineConfig,
    getSipStackStatus: getSipStackStatus,
    stop: stop,
    dial: dial,
    answer: answer,
    answerBySipCallId: answerBySipCallId,
    attendedTransfer: attendedTransfer,
    completeTransfer: completeTransfer,
    toggleMicrophone: toggleMicrophone,
    conference: conference,
    dtmf: dtmf,
    hold: hold,
    holdBySipCallId: holdBySipCallId,
    setHandler: setHandler,
    clearHandlers: clearHandlers,
    disableICE: disableICE,
    setIceUrls: setIceUrls,
    getIceUrls: getIceUrls,
    setDebug: setDebug,
    injectTestDependencies: injectTestDependencies,
    getRegisterTimeoutStep: getRegisterTimeoutStep,
    getMediaTypeBySipCallId: getMediaTypeBySipCallId,
    getAudioContext: getAudioContext,
    setRemoteStreamHandler: setRemoteStreamHandler,
    setLocalStreamHandler: setLocalStreamHandler,
    getCurrentRTCPeerConnection: getCurrentRTCPeerConnection,
    createAndGetMixedTrack: createAndGetMixedTrack,
    replaceUnderscores: replaceUnderscores,
    doesSessionExists: doesSessionExists,
    setCustomLogger: setCustomLogger
  };
}();

xc_webrtc.MessageType = {
  GENERAL: "general",
  OUTGOING: "outgoing",
  INCOMING: "incoming",
  REGISTRATION: "registration",
};

xc_webrtc.General = {
  STARTED: "Started",
  FAILED: "Failed",
};

xc_webrtc.Incoming = {
  SETUP: "Setup",
  RINGING: "Ringing",
  REMOTE_MEDIA_ADDED: "RemoteMediaAdded",
  CONNECTED: "Connected",
  TERMINATED: "Terminated",
  HOLD: "Hold",
  RESUME: "Resume",
};

xc_webrtc.Outgoing = {
  ESTABLISHING: "Establishing",
  RINGING: "Ringing",
  CONNECTED: "Connected",
  TERMINATED: "Terminated",
  FAILED: "Failed",
  HOLD: "Hold",
  RESUME: "Resume",
};

xc_webrtc.Registration = {
  REGISTERED: "Registered",
  UNREGISTERED: "Unregistered",
};

xc_webrtc.mediaType = {
  AUDIO: "audio"
};
