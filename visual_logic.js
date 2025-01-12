/* eslint-disable */

/**
 * Prefer not editing this file as your changes may get overwritten once saved.
 */
function createPL(v3d=window.v3d) {

    // global variables used in the init tab
    const _initGlob = {
        percentage: 0,
        output: {
            initOptions: {
                fadeAnnotations: true,
                useBkgTransp: false,
                preserveDrawBuf: false,
                useCompAssets: false,
                useFullscreen: true,
                useCustomPreloader: false,
                preloaderStartCb: function() {},
                preloaderProgressCb: function() {},
                preloaderEndCb: function() {},
            },
        },
    };

    // global variables/constants used by puzzles' functions
    var _pGlob = {};

    _pGlob.objCache = {};
    _pGlob.fadeAnnotations = true;
    _pGlob.pickedObject = '';
    _pGlob.hoveredObject = '';
    _pGlob.mediaElements = {};
    _pGlob.loadedFile = '';
    _pGlob.states = [];
    _pGlob.percentage = 0;
    _pGlob.openedFile = '';
    _pGlob.openedFileMeta = {};
    _pGlob.xrSessionAcquired = false;
    _pGlob.xrSessionCallbacks = [];
    _pGlob.screenCoords = new v3d.Vector2();
    _pGlob.intervalTimers = {};
    _pGlob.customEvents = new v3d.EventDispatcher();
    _pGlob.eventListeners = [];
    _pGlob.htmlElements = new Set();
    _pGlob.materialsCache = new Map();

    _pGlob.AXIS_X = new v3d.Vector3(1,0,0);
    _pGlob.AXIS_Y = new v3d.Vector3(0,1,0);
    _pGlob.AXIS_Z = new v3d.Vector3(0,0,1);
    _pGlob.MIN_DRAG_SCALE = 10e-4;
    _pGlob.SET_OBJ_ROT_EPS = 1e-8;

    _pGlob.vec2Tmp = new v3d.Vector2();
    _pGlob.vec2Tmp2 = new v3d.Vector2();
    _pGlob.vec3Tmp = new v3d.Vector3();
    _pGlob.vec3Tmp2 = new v3d.Vector3();
    _pGlob.vec3Tmp3 = new v3d.Vector3();
    _pGlob.vec3Tmp4 = new v3d.Vector3();
    _pGlob.eulerTmp = new v3d.Euler();
    _pGlob.eulerTmp2 = new v3d.Euler();
    _pGlob.quatTmp = new v3d.Quaternion();
    _pGlob.quatTmp2 = new v3d.Quaternion();
    _pGlob.colorTmp = new v3d.Color();
    _pGlob.mat4Tmp = new v3d.Matrix4();
    _pGlob.planeTmp = new v3d.Plane();
    _pGlob.raycasterTmp = new v3d.Raycaster();
    // always check visibility

    const createPzLib = ({v3d=null, appInstance=null}) => {
        function getElement(id, isParent=false) {
            let elem;
            if (Array.isArray(id) && id[0] === 'CONTAINER') {
                if (appInstance !== null) {
                    elem = appInstance.container;
                } else if (typeof _initGlob !== 'undefined') {
                    // if we are on the initialization stage, we still can have access
                    // to the container element
                    const contId = _initGlob.container;
                    elem = isParent ? parent.document.getElementById(contId) : document.getElementById(contId);
                }
            } else if (Array.isArray(id) && id[0] === 'WINDOW') {
                elem = isParent ? parent : window;
            } else if (Array.isArray(id) && id[0] === 'DOCUMENT') {
                elem = isParent ? parent.document : document;
            } else if (Array.isArray(id) && id[0] === 'BODY') {
                elem = isParent ? parent.document.body : document.body;
            } else if (Array.isArray(id) && id[0] === 'QUERYSELECTOR') {
                elem = isParent ? parent.document.querySelector(id) : document.querySelector(id);
            } else {
                elem = isParent ? parent.document.getElementById(id) : document.getElementById(id);
            }
            return elem;
        }

        function getElements(ids, isParent=false) {
            const elems = [];
            if (Array.isArray(ids) && ids[0] !== 'CONTAINER' && ids[0] !== 'WINDOW' && ids[0] !== 'DOCUMENT' && ids[0] !== 'BODY' && ids[0] !== 'QUERYSELECTOR') {
                for (let i = 0; i < ids.length; i++) {
                    elems.push(getElement(ids[i], isParent));
                }
            } else {
                elems.push(getElement(ids, isParent));
            }
            return elems;
        }

        function areListenersSame(target0, type0, listener0, optionsOrUseCapture0, target1, type1, listener1, optionsOrUseCapture1) {
            const capture0 = Boolean(optionsOrUseCapture0 instanceof Object ? optionsOrUseCapture0.capture : optionsOrUseCapture0);
            const capture1 = Boolean(optionsOrUseCapture1 instanceof Object ? optionsOrUseCapture1.capture : optionsOrUseCapture1);
            return target0 === target1 && type0 === type1 && listener0 === listener1 && capture0 === capture1;
        }

        function bindListener(target, type, listener, optionsOrUseCapture) {
            const alreadyExists = _pGlob.eventListeners.some(elem => {
                return areListenersSame(elem.target, elem.type, elem.listener, elem.optionsOrUseCapture, target, type, listener, optionsOrUseCapture);
            }
            );

            if (!alreadyExists) {
                target.addEventListener(type, listener, optionsOrUseCapture);
                _pGlob.eventListeners.push({
                    target,
                    type,
                    listener,
                    optionsOrUseCapture
                });
            }
        }

        function getSceneAnimFrameRate(scene) {
            if (scene && 'animFrameRate'in scene.userData) {
                return scene.userData.animFrameRate;
            }
            return 24;
        }

        function getSceneByAction(action) {
            const root = action.getRoot();
            let scene = root.type === 'Scene' ? root : null;
            root.traverseAncestors(ancObj => {
                if (ancObj.type === 'Scene') {
                    scene = ancObj;
                }
            }
            );
            return scene;
        }

        function getMaterialEditableTextures(matName, collectSameNameMats=false) {
            let mats = [];
            if (collectSameNameMats) {
                mats = v3d.SceneUtils.getMaterialsByName(appInstance, matName);
            } else {
                const firstMat = v3d.SceneUtils.getMaterialByName(appInstance, matName);
                if (firstMat !== null) {
                    mats = [firstMat];
                }
            }

            const textures = mats.reduce( (texArray, mat) => {
                let matTextures = [];
                switch (mat.type) {
                case 'MeshNodeMaterial':
                    matTextures = Object.values(mat.nodeTextures);
                    break;

                case 'MeshStandardMaterial':
                    matTextures = [mat.map, mat.lightMap, mat.aoMap, mat.emissiveMap, mat.bumpMap, mat.normalMap, mat.displacementMap, mat.roughnessMap, mat.metalnessMap, mat.alphaMap, mat.envMap];
                    break;

                default:
                    console.error('getMaterialEditableTextures: Unknown material type ' + mat.type);
                    break;
                }

                Array.prototype.push.apply(texArray, matTextures);
                return texArray;
            }
            , []);

            return textures.filter(elem => {
                // check Texture type exactly
                return elem && (elem.constructor === v3d.Texture || elem.constructor === v3d.CompressedTexture || elem.constructor === v3d.DataTexture || elem.constructor === v3d.CanvasTexture || elem.constructor === v3d.VideoTexture);
            }
            );
        }

        function replaceMaterialEditableTexture(mat, oldTex, newTex) {
            if (v3d.MaterialUtils.replaceTexture) {
                v3d.MaterialUtils.replaceTexture(mat, oldTex, newTex);
                return;
            }

            // COMPAT: <4.8, had no replaceTexture() method
            switch (mat.type) {
            case 'MeshNodeMaterial':
                // NOTE: replace in node graph as well since it's possible to texture get lost
                // after updateNodeGraph()
                mat.traverseNodes(node => {
                    if (node.originData.texture === oldTex)
                        node.originData.texture = newTex;
                }
                );

                for (const name in mat.nodeTextures) {
                    if (mat.nodeTextures[name] === oldTex) {
                        mat.nodeTextures[name] = newTex;
                    }
                }
                break;

            case 'MeshStandardMaterial':
                const texNames = ['map', 'lightMap', 'aoMap', 'emissiveMap', 'bumpMap', 'normalMap', 'displacementMap', 'roughnessMap', 'metalnessMap', 'alphaMap', 'envMap'];

                texNames.forEach(name => {
                    if (mat[name] === oldTex) {
                        mat[name] = newTex;
                    }
                }
                );
                break;

            default:
                console.error('replaceMaterialEditableTexture: Unsupported material type ' + mat.type);
                break;
            }

            // inherit some save params
            newTex.encoding = oldTex.encoding;
            newTex.wrapS = oldTex.wrapS;
            newTex.wrapT = oldTex.wrapT;
        }

        function getMaterialEditableColors(matName) {
            const mat = v3d.SceneUtils.getMaterialByName(appInstance, matName);
            if (!mat) {
                return [];
            }

            if (mat.isMeshNodeMaterial) {
                return Object.keys(mat.nodeRGBMap);
            } else if (mat.isMeshStandardMaterial) {
                return ['color', 'emissive'];
            } else {
                return [];
            }
        }

        function isObjectWorthProcessing(obj) {
            return obj.type !== 'AmbientLight' && obj.name !== '' && !(obj.isMesh && obj.isMaterialGeneratedMesh) && !obj.isAuxClippingMesh;
        }

        function getObjectByName(objName) {
            let objFound = null;

            const pGlobAvailable = _pGlob !== undefined;
            if (pGlobAvailable && objName in _pGlob.objCache) {
                objFound = _pGlob.objCache[objName] || null;
            }

            if (objFound && objFound.name === objName) {
                return objFound;
            }

            if (appInstance.scene) {
                appInstance.scene.traverse(obj => {
                    if (!objFound && isObjectWorthProcessing(obj) && (obj.name === objName)) {
                        objFound = obj;
                        if (pGlobAvailable) {
                            _pGlob.objCache[objName] = objFound;
                        }
                    }
                }
                );
            }
            return objFound;
        }

        function getObjectNamesByGroupName(groupName) {
            const objNameList = [];
            appInstance.scene.traverse(obj => {
                if (isObjectWorthProcessing(obj)) {
                    const objGroupNames = obj.groupNames;
                    if (!objGroupNames) {
                        return;
                    }

                    for (let i = 0; i < objGroupNames.length; i++) {
                        const objGroupName = objGroupNames[i];
                        if (objGroupName === groupName) {
                            objNameList.push(obj.name);
                        }
                    }
                }
            }
            );
            return objNameList;
        }

        function getAllObjectNames() {
            const objNameList = [];
            appInstance.scene.traverse(obj => {
                if (isObjectWorthProcessing(obj)) {
                    objNameList.push(obj.name);
                }
            }
            );
            return objNameList;
        }

        function retrieveObjectNamesAccum(currObjNames, namesAccum) {
            if (typeof currObjNames === 'string') {
                namesAccum.push(currObjNames);
            } else if (Array.isArray(currObjNames) && currObjNames[0] === 'GROUP') {
                const newObjNames = getObjectNamesByGroupName(currObjNames[1]);
                for (let i = 0; i < newObjNames.length; i++) {
                    namesAccum.push(newObjNames[i]);
                }
            } else if (Array.isArray(currObjNames) && currObjNames[0] === 'ALL_OBJECTS') {
                const newObjNames = getAllObjectNames();
                for (let i = 0; i < newObjNames.length; i++) {
                    namesAccum.push(newObjNames[i]);
                }
            } else if (Array.isArray(currObjNames)) {
                for (let i = 0; i < currObjNames.length; i++) {
                    retrieveObjectNamesAccum(currObjNames[i], namesAccum);
                }
            }
        }

        function retrieveObjectNames(objNames) {
            const accum = [];
            retrieveObjectNamesAccum(objNames, accum);
            return accum.filter(name => name !== '');
        }

        function isBlobUrl(obj) {
            return (typeof obj === 'string' && obj.indexOf('blob:') === 0);
        }

        function isDataUrl(obj) {
            // NOTE: checking with dataUrlRe is slow
            return (typeof obj === 'string' && obj.indexOf('data:') === 0);
        }

        function encodeUnicodeStrToBase64(str) {
            return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, function toSolidBytes(match, p1) {
                return String.fromCharCode('0x' + p1);
            }));
        }

        function convertObjToJsonDataUrl(obj, mime='application/json') {
            if (typeof obj !== 'string') {
                obj = JSON.stringify(obj);
            }
            return 'data:' + mime + ';base64,' + encodeUnicodeStrToBase64(obj);
        }

        function convertObjToTextDataUrl(obj) {
            if (typeof obj !== 'string') {
                obj = JSON.stringify(obj);
            }
            return 'data:text/plain;base64,' + encodeUnicodeStrToBase64(obj);
        }

        const LIST_NONE = '<none>';

        function getMaterialEditableValues(matName) {
            const mat = v3d.SceneUtils.getMaterialByName(appInstance, matName);
            if (!mat) {
                return [];
            }

            if (mat.isMeshNodeMaterial) {
                return Object.keys(mat.nodeValueMap);
            } else if (mat.isMeshStandardMaterial) {
                return ['metalness', 'roughness', 'bumpScale', 'emissiveIntensity', 'envMapIntensity'];
            } else {
                return [];
            }
        }

        return {
            getElements,
            bindListener,
            getSceneAnimFrameRate,
            getSceneByAction,
            getMaterialEditableTextures,
            replaceMaterialEditableTexture,
            getElement,
            getMaterialEditableColors,
            getObjectByName,
            retrieveObjectNames,
            isBlobUrl,
            isDataUrl,
            convertObjToJsonDataUrl,
            convertObjToTextDataUrl,
            LIST_NONE,
            getMaterialEditableValues,
        };
    }
    ;

    var PL = {};

    // backward compatibility
    if (v3d[Symbol.toStringTag] !== 'Module') {
        v3d.PL = v3d.puzzles = PL;
    }

    PL.procedures = PL.procedures || {};

    PL.execInitPuzzles = function(options) {
        // always null, should not be available in "init" puzzles
        var appInstance = null;
        // app is more conventional than appInstance (used in exec script and app templates)
        var app = null;

        const PzLib = createPzLib({
            v3d
        });

        // provide the container's id to puzzles that need access to the container
        _initGlob.container = options !== undefined && 'container'in options ? options.container : "";

        // setCSSRuleStyle puzzle
        function setCSSRuleStyle(prop, value, id, isParent, mediaRule) {
            const styles = (isParent) ? parent.document.styleSheets : document.styleSheets;
            for (let i = 0; i < styles.length; i++) {
                /**
         * workaround for "DOMException: Failed to read the 'cssRules' property
         * from 'CSSStyleSheet': Cannot access rules"
         */
                let cssRules;
                try {
                    cssRules = styles[i].cssRules;
                } catch (e) {
                    continue;
                }

                for (let j = 0; j < cssRules.length; j++) {
                    const cssRule = cssRules[j];
                    if (!mediaRule && cssRule.selectorText == id)
                        cssRule.style[prop] = value;
                    else if (mediaRule && cssRule.media && cssRule.media.mediaText == mediaRule) {
                        const cssRulesMedia = cssRule.cssRules;
                        for (let k = 0; k < cssRulesMedia.length; k++) {
                            if (cssRulesMedia[k].selectorText == id)
                                cssRulesMedia[k].style[prop] = value;
                        }
                    }
                }
            }
        }

        // setHTMLElemStyle puzzle
        function setHTMLElemStyle(prop, value, ids, isParent) {
            var elems = PzLib.getElements(ids, isParent);
            for (var i = 0; i < elems.length; i++) {
                var elem = elems[i];
                if (!elem || !elem.style)
                    continue;
                elem.style[prop] = value;
            }
        }

        // initSettings puzzle
        _initGlob.output.initOptions.fadeAnnotations = true;
        _initGlob.output.initOptions.useBkgTransp = true;
        _initGlob.output.initOptions.preserveDrawBuf = true;
        _initGlob.output.initOptions.useCompAssets = true;
        _initGlob.output.initOptions.useFullscreen = true;

        setCSSRuleStyle('outlineColor', 'black', '.v3d-simple-preloader-bar', false, '');

        setCSSRuleStyle('background', 'black', '.v3d-simple-preloader-bar', false, '');

        setCSSRuleStyle('backgroundImage', 'url(\'./preloader.gif\')', '.v3d-simple-preloader-logo', false, '');

        setCSSRuleStyle('backgroundColor', 'transparent', '.v3d-simple-preloader-background', false, '');

        setHTMLElemStyle('display', 'none', 'closebutton', true);
        setHTMLElemStyle('display', 'none', 'closebutton2', true);
        setHTMLElemStyle('display', 'none', 'color2', true);
        setHTMLElemStyle('display', 'none', 'color3', true);

        setHTMLElemStyle('display', 'none', 'closebtn1', true);
        setHTMLElemStyle('display', 'none', 'closebuttonuv', true);
        setHTMLElemStyle('display', 'none', 'prosignal', true);
        setHTMLElemStyle('display', 'none', 'prosignal2', true);
        setHTMLElemStyle('display', 'none', 'prosignal3', true);
        setHTMLElemStyle('display', 'none', 'prosignal4', true);

        return _initGlob.output;
    }

    PL.init = function(appInstance, initOptions) {

        // app is more conventional than appInstance (used in exec script and app templates)
        var app = appInstance;

        const PzLib = createPzLib({
            v3d,
            appInstance
        });

        initOptions = initOptions || {};

        if ('fadeAnnotations'in initOptions) {
            _pGlob.fadeAnnotations = initOptions.fadeAnnotations;
        }

        this.procedures["create_bg_canvas"] = create_bg_canvas;
        this.procedures["remove_bg_canvas"] = remove_bg_canvas;
        this.procedures["dispatchEvent"] = dispatchEvent;

        var PROC = {
            "create_bg_canvas": create_bg_canvas,
            "remove_bg_canvas": remove_bg_canvas,
            "dispatchEvent": dispatchEvent,
        };

        var myDrawer2, mydrawer3, imagebg, tshirts, anims, eventName, valuesObject, openuv, value, openuv2, camera_bgs;

        _pGlob.animMixerCallbacks = [];

        var initAnimationMixer = function() {

            function onMixerFinished(e) {
                var cb = _pGlob.animMixerCallbacks;
                var found = [];
                for (var i = 0; i < cb.length; i++) {
                    if (cb[i][0] == e.action) {
                        cb[i][0] = null;
                        // desactivate
                        found.push(cb[i][1]);
                    }
                }
                for (var i = 0; i < found.length; i++) {
                    found[i]();
                }
            }

            return function initAnimationMixer() {
                if (appInstance.mixer && !appInstance.mixer.hasEventListener('finished', onMixerFinished)) {
                    PzLib.bindListener(appInstance.mixer, 'finished', onMixerFinished);
                }
            }
            ;

        }();

        // animation puzzles
        function operateAnimation(operation, animations, from, to, loop, speed, callback, rev) {
            if (!animations)
                return;
            // input can be either single obj or array of objects
            if (typeof animations == "string")
                animations = [animations];

            function processAnimation(animName) {
                var action = v3d.SceneUtils.getAnimationActionByName(appInstance, animName);
                if (!action)
                    return;
                switch (operation) {
                case 'PLAY':
                    if (!action.isRunning()) {
                        action.reset();
                        if (loop && (loop != "AUTO"))
                            action.loop = v3d[loop];
                        var scene = PzLib.getSceneByAction(action);
                        var frameRate = PzLib.getSceneAnimFrameRate(scene);

                        action.repetitions = Infinity;

                        var timeScale = Math.abs(parseFloat(speed));
                        if (rev)
                            timeScale *= -1;

                        action.timeScale = timeScale;
                        action.timeStart = from !== null ? from / frameRate : 0;
                        if (to !== null) {
                            action.getClip().duration = to / frameRate;
                        } else {
                            action.getClip().resetDuration();
                        }
                        action.time = timeScale >= 0 ? action.timeStart : action.getClip().duration;

                        action.paused = false;
                        action.play();

                        // push unique callbacks only
                        var callbacks = _pGlob.animMixerCallbacks;
                        var found = false;

                        for (var j = 0; j < callbacks.length; j++)
                            if (callbacks[j][0] == action && callbacks[j][1] == callback)
                                found = true;

                        if (!found)
                            _pGlob.animMixerCallbacks.push([action, callback]);
                    }
                    break;
                case 'STOP':
                    action.stop();

                    // remove callbacks
                    var callbacks = _pGlob.animMixerCallbacks;
                    for (var j = 0; j < callbacks.length; j++)
                        if (callbacks[j][0] == action) {
                            callbacks.splice(j, 1);
                            j--
                        }

                    break;
                case 'PAUSE':
                    action.paused = true;
                    break;
                case 'RESUME':
                    action.paused = false;
                    break;
                case 'SET_FRAME':
                    var scene = PzLib.getSceneByAction(action);
                    var frameRate = PzLib.getSceneAnimFrameRate(scene);
                    action.time = from ? from / frameRate : 0;
                    action.play();
                    action.paused = true;
                    break;
                case 'SET_SPEED':
                    var timeScale = parseFloat(speed);
                    action.timeScale = rev ? -timeScale : timeScale;
                    break;
                }
            }

            for (var i = 0; i < animations.length; i++) {
                var animName = animations[i];
                if (animName)
                    processAnimation(animName);
            }

            initAnimationMixer();
        }

        function cf_drawInit() {
            return (function(selector, toolsPanelSide, containerWidth, containerHeight, canvasScale, extensionsJSON, backgroundLayers, containerBackgroundLayers) {
                let $out = '';

                // && window.location.search.indexOf('visual_logic.xml') === -1
                if (selector != '') {
                    //konva
                    if (window['Konva'] === undefined) {
                        !function(t, e) {
                            "object" == typeof exports && "undefined" != typeof module ? module.exports = e() : "function" == typeof define && define.amd ? define(e) : (t = t || self).Konva = e()
                        }(this, function() {
                            "use strict";
                            var e = Math.PI / 180;
                            function t(t) {
                                var e = t.toLowerCase()
                                  , i = /(chrome)[ /]([\w.]+)/.exec(e) || /(webkit)[ /]([\w.]+)/.exec(e) || /(opera)(?:.*version|)[ /]([\w.]+)/.exec(e) || /(msie) ([\w.]+)/.exec(e) || e.indexOf("compatible") < 0 && /(mozilla)(?:.*? rv:([\w.]+)|)/.exec(e) || []
                                  , n = !!t.match(/Android|BlackBerry|iPhone|iPad|iPod|Opera Mini|IEMobile/i)
                                  , r = !!t.match(/IEMobile/i);
                                return {
                                    browser: i[1] || "",
                                    version: i[2] || "0",
                                    isIE: function(t) {
                                        var e = t.indexOf("msie ");
                                        if (0 < e)
                                            return parseInt(t.substring(e + 5, t.indexOf(".", e)), 10);
                                        if (0 < t.indexOf("trident/")) {
                                            var i = t.indexOf("rv:");
                                            return parseInt(t.substring(i + 3, t.indexOf(".", i)), 10)
                                        }
                                        var n = t.indexOf("edge/");
                                        return 0 < n && parseInt(t.substring(n + 5, t.indexOf(".", n)), 10)
                                    }(e),
                                    mobile: n,
                                    ieMobile: r
                                }
                            }
                            function i(t) {
                                s[t.prototype.getClassName()] = t,
                                G[t.prototype.getClassName()] = t
                            }
                            var n = "undefined" != typeof global ? global : "undefined" != typeof window ? window : "undefined" != typeof WorkerGlobalScope ? self : {}
                              , G = {
                                _global: n,
                                version: "7.0.3",
                                isBrowser: "undefined" != typeof window && ("[object Window]" === {}.toString.call(window) || "[object global]" === {}.toString.call(window)),
                                isUnminified: /param/.test(function(t) {}
                                .toString()),
                                dblClickWindow: 400,
                                getAngle: function(t) {
                                    return G.angleDeg ? t * e : t
                                },
                                enableTrace: !1,
                                _pointerEventsEnabled: !1,
                                hitOnDragEnabled: !1,
                                captureTouchEventsEnabled: !1,
                                listenClickTap: !1,
                                inDblClickWindow: !1,
                                pixelRatio: void 0,
                                dragDistance: 3,
                                angleDeg: !0,
                                showWarnings: !0,
                                dragButtons: [0, 1],
                                isDragging: function() {
                                    return G.DD.isDragging
                                },
                                isDragReady: function() {
                                    return !!G.DD.node
                                },
                                UA: t(n.navigator && n.navigator.userAgent || ""),
                                document: n.document,
                                _injectGlobal: function(t) {
                                    n.Konva = t
                                },
                                _parseUA: t
                            }
                              , s = {}
                              , o = (r.toCollection = function(t) {
                                for (var e = new r, i = t.length, n = 0; n < i; n++)
                                    e.push(t[n]);
                                return e
                            }
                            ,
                            r._mapMethod = function(n) {
                                r.prototype[n] = function() {
                                    for (var t = this.length, e = [].slice.call(arguments), i = 0; i < t; i++)
                                        this[i][n].apply(this[i], e);
                                    return this
                                }
                            }
                            ,
                            r.mapMethods = function(t) {
                                var e = t.prototype;
                                for (var i in e)
                                    r._mapMethod(i)
                            }
                            ,
                            r);
                            function r() {}
                            o.prototype = [],
                            o.prototype.each = function(t) {
                                for (var e = 0; e < this.length; e++)
                                    t(this[e], e)
                            }
                            ,
                            o.prototype.toArray = function() {
                                for (var t = [], e = this.length, i = 0; i < e; i++)
                                    t.push(this[i]);
                                return t
                            }
                            ;
                            var p = (a.prototype.reset = function() {
                                this.m[0] = 1,
                                this.m[1] = 0,
                                this.m[2] = 0,
                                this.m[3] = 1,
                                this.m[4] = 0,
                                this.m[5] = 0
                            }
                            ,
                            a.prototype.copy = function() {
                                return new a(this.m)
                            }
                            ,
                            a.prototype.copyInto = function(t) {
                                t.m[0] = this.m[0],
                                t.m[1] = this.m[1],
                                t.m[2] = this.m[2],
                                t.m[3] = this.m[3],
                                t.m[4] = this.m[4],
                                t.m[5] = this.m[5]
                            }
                            ,
                            a.prototype.point = function(t) {
                                var e = this.m;
                                return {
                                    x: e[0] * t.x + e[2] * t.y + e[4],
                                    y: e[1] * t.x + e[3] * t.y + e[5]
                                }
                            }
                            ,
                            a.prototype.translate = function(t, e) {
                                return this.m[4] += this.m[0] * t + this.m[2] * e,
                                this.m[5] += this.m[1] * t + this.m[3] * e,
                                this
                            }
                            ,
                            a.prototype.scale = function(t, e) {
                                return this.m[0] *= t,
                                this.m[1] *= t,
                                this.m[2] *= e,
                                this.m[3] *= e,
                                this
                            }
                            ,
                            a.prototype.rotate = function(t) {
                                var e = Math.cos(t)
                                  , i = Math.sin(t)
                                  , n = this.m[0] * e + this.m[2] * i
                                  , r = this.m[1] * e + this.m[3] * i
                                  , o = this.m[0] * -i + this.m[2] * e
                                  , a = this.m[1] * -i + this.m[3] * e;
                                return this.m[0] = n,
                                this.m[1] = r,
                                this.m[2] = o,
                                this.m[3] = a,
                                this
                            }
                            ,
                            a.prototype.getTranslation = function() {
                                return {
                                    x: this.m[4],
                                    y: this.m[5]
                                }
                            }
                            ,
                            a.prototype.skew = function(t, e) {
                                var i = this.m[0] + this.m[2] * e
                                  , n = this.m[1] + this.m[3] * e
                                  , r = this.m[2] + this.m[0] * t
                                  , o = this.m[3] + this.m[1] * t;
                                return this.m[0] = i,
                                this.m[1] = n,
                                this.m[2] = r,
                                this.m[3] = o,
                                this
                            }
                            ,
                            a.prototype.multiply = function(t) {
                                var e = this.m[0] * t.m[0] + this.m[2] * t.m[1]
                                  , i = this.m[1] * t.m[0] + this.m[3] * t.m[1]
                                  , n = this.m[0] * t.m[2] + this.m[2] * t.m[3]
                                  , r = this.m[1] * t.m[2] + this.m[3] * t.m[3]
                                  , o = this.m[0] * t.m[4] + this.m[2] * t.m[5] + this.m[4]
                                  , a = this.m[1] * t.m[4] + this.m[3] * t.m[5] + this.m[5];
                                return this.m[0] = e,
                                this.m[1] = i,
                                this.m[2] = n,
                                this.m[3] = r,
                                this.m[4] = o,
                                this.m[5] = a,
                                this
                            }
                            ,
                            a.prototype.invert = function() {
                                var t = 1 / (this.m[0] * this.m[3] - this.m[1] * this.m[2])
                                  , e = this.m[3] * t
                                  , i = -this.m[1] * t
                                  , n = -this.m[2] * t
                                  , r = this.m[0] * t
                                  , o = t * (this.m[2] * this.m[5] - this.m[3] * this.m[4])
                                  , a = t * (this.m[1] * this.m[4] - this.m[0] * this.m[5]);
                                return this.m[0] = e,
                                this.m[1] = i,
                                this.m[2] = n,
                                this.m[3] = r,
                                this.m[4] = o,
                                this.m[5] = a,
                                this
                            }
                            ,
                            a.prototype.getMatrix = function() {
                                return this.m
                            }
                            ,
                            a.prototype.setAbsolutePosition = function(t, e) {
                                var i = this.m[0]
                                  , n = this.m[1]
                                  , r = this.m[2]
                                  , o = this.m[3]
                                  , a = this.m[4]
                                  , s = (i * (e - this.m[5]) - n * (t - a)) / (i * o - n * r)
                                  , h = (t - a - r * s) / i;
                                return this.translate(h, s)
                            }
                            ,
                            a.prototype.decompose = function() {
                                var t, e, i = this.m[0], n = this.m[1], r = this.m[2], o = this.m[3], a = i * o - n * r, s = {
                                    x: this.m[4],
                                    y: this.m[5],
                                    rotation: 0,
                                    scaleX: 0,
                                    scaleY: 0,
                                    skewX: 0,
                                    skewY: 0
                                };
                                return 0 != i || 0 != n ? (t = Math.sqrt(i * i + n * n),
                                s.rotation = 0 < n ? Math.acos(i / t) : -Math.acos(i / t),
                                s.scaleX = t,
                                s.scaleY = a / t,
                                s.skewX = (i * r + n * o) / a,
                                s.skewY = 0) : 0 == r && 0 == o || (e = Math.sqrt(r * r + o * o),
                                s.rotation = Math.PI / 2 - (0 < o ? Math.acos(-r / e) : -Math.acos(r / e)),
                                s.scaleX = a / e,
                                s.scaleY = e,
                                s.skewX = 0,
                                s.skewY = (i * r + n * o) / a),
                                s.rotation = A._getRotation(s.rotation),
                                s
                            }
                            ,
                            a);
                            function a(t) {
                                void 0 === t && (t = [1, 0, 0, 1, 0, 0]),
                                this.dirty = !1,
                                this.m = t && t.slice() || [1, 0, 0, 1, 0, 0]
                            }
                            var h = Math.PI / 180
                              , l = 180 / Math.PI
                              , c = "Konva error: "
                              , d = {
                                aliceblue: [240, 248, 255],
                                antiquewhite: [250, 235, 215],
                                aqua: [0, 255, 255],
                                aquamarine: [127, 255, 212],
                                azure: [240, 255, 255],
                                beige: [245, 245, 220],
                                bisque: [255, 228, 196],
                                black: [0, 0, 0],
                                blanchedalmond: [255, 235, 205],
                                blue: [0, 0, 255],
                                blueviolet: [138, 43, 226],
                                brown: [165, 42, 42],
                                burlywood: [222, 184, 135],
                                cadetblue: [95, 158, 160],
                                chartreuse: [127, 255, 0],
                                chocolate: [210, 105, 30],
                                coral: [255, 127, 80],
                                cornflowerblue: [100, 149, 237],
                                cornsilk: [255, 248, 220],
                                crimson: [220, 20, 60],
                                cyan: [0, 255, 255],
                                darkblue: [0, 0, 139],
                                darkcyan: [0, 139, 139],
                                darkgoldenrod: [184, 132, 11],
                                darkgray: [169, 169, 169],
                                darkgreen: [0, 100, 0],
                                darkgrey: [169, 169, 169],
                                darkkhaki: [189, 183, 107],
                                darkmagenta: [139, 0, 139],
                                darkolivegreen: [85, 107, 47],
                                darkorange: [255, 140, 0],
                                darkorchid: [153, 50, 204],
                                darkred: [139, 0, 0],
                                darksalmon: [233, 150, 122],
                                darkseagreen: [143, 188, 143],
                                darkslateblue: [72, 61, 139],
                                darkslategray: [47, 79, 79],
                                darkslategrey: [47, 79, 79],
                                darkturquoise: [0, 206, 209],
                                darkviolet: [148, 0, 211],
                                deeppink: [255, 20, 147],
                                deepskyblue: [0, 191, 255],
                                dimgray: [105, 105, 105],
                                dimgrey: [105, 105, 105],
                                dodgerblue: [30, 144, 255],
                                firebrick: [178, 34, 34],
                                floralwhite: [255, 255, 240],
                                forestgreen: [34, 139, 34],
                                fuchsia: [255, 0, 255],
                                gainsboro: [220, 220, 220],
                                ghostwhite: [248, 248, 255],
                                gold: [255, 215, 0],
                                goldenrod: [218, 165, 32],
                                gray: [128, 128, 128],
                                green: [0, 128, 0],
                                greenyellow: [173, 255, 47],
                                grey: [128, 128, 128],
                                honeydew: [240, 255, 240],
                                hotpink: [255, 105, 180],
                                indianred: [205, 92, 92],
                                indigo: [75, 0, 130],
                                ivory: [255, 255, 240],
                                khaki: [240, 230, 140],
                                lavender: [230, 230, 250],
                                lavenderblush: [255, 240, 245],
                                lawngreen: [124, 252, 0],
                                lemonchiffon: [255, 250, 205],
                                lightblue: [173, 216, 230],
                                lightcoral: [240, 128, 128],
                                lightcyan: [224, 255, 255],
                                lightgoldenrodyellow: [250, 250, 210],
                                lightgray: [211, 211, 211],
                                lightgreen: [144, 238, 144],
                                lightgrey: [211, 211, 211],
                                lightpink: [255, 182, 193],
                                lightsalmon: [255, 160, 122],
                                lightseagreen: [32, 178, 170],
                                lightskyblue: [135, 206, 250],
                                lightslategray: [119, 136, 153],
                                lightslategrey: [119, 136, 153],
                                lightsteelblue: [176, 196, 222],
                                lightyellow: [255, 255, 224],
                                lime: [0, 255, 0],
                                limegreen: [50, 205, 50],
                                linen: [250, 240, 230],
                                magenta: [255, 0, 255],
                                maroon: [128, 0, 0],
                                mediumaquamarine: [102, 205, 170],
                                mediumblue: [0, 0, 205],
                                mediumorchid: [186, 85, 211],
                                mediumpurple: [147, 112, 219],
                                mediumseagreen: [60, 179, 113],
                                mediumslateblue: [123, 104, 238],
                                mediumspringgreen: [0, 250, 154],
                                mediumturquoise: [72, 209, 204],
                                mediumvioletred: [199, 21, 133],
                                midnightblue: [25, 25, 112],
                                mintcream: [245, 255, 250],
                                mistyrose: [255, 228, 225],
                                moccasin: [255, 228, 181],
                                navajowhite: [255, 222, 173],
                                navy: [0, 0, 128],
                                oldlace: [253, 245, 230],
                                olive: [128, 128, 0],
                                olivedrab: [107, 142, 35],
                                orange: [255, 165, 0],
                                orangered: [255, 69, 0],
                                orchid: [218, 112, 214],
                                palegoldenrod: [238, 232, 170],
                                palegreen: [152, 251, 152],
                                paleturquoise: [175, 238, 238],
                                palevioletred: [219, 112, 147],
                                papayawhip: [255, 239, 213],
                                peachpuff: [255, 218, 185],
                                peru: [205, 133, 63],
                                pink: [255, 192, 203],
                                plum: [221, 160, 203],
                                powderblue: [176, 224, 230],
                                purple: [128, 0, 128],
                                rebeccapurple: [102, 51, 153],
                                red: [255, 0, 0],
                                rosybrown: [188, 143, 143],
                                royalblue: [65, 105, 225],
                                saddlebrown: [139, 69, 19],
                                salmon: [250, 128, 114],
                                sandybrown: [244, 164, 96],
                                seagreen: [46, 139, 87],
                                seashell: [255, 245, 238],
                                sienna: [160, 82, 45],
                                silver: [192, 192, 192],
                                skyblue: [135, 206, 235],
                                slateblue: [106, 90, 205],
                                slategray: [119, 128, 144],
                                slategrey: [119, 128, 144],
                                snow: [255, 255, 250],
                                springgreen: [0, 255, 127],
                                steelblue: [70, 130, 180],
                                tan: [210, 180, 140],
                                teal: [0, 128, 128],
                                thistle: [216, 191, 216],
                                transparent: [255, 255, 255, 0],
                                tomato: [255, 99, 71],
                                turquoise: [64, 224, 208],
                                violet: [238, 130, 238],
                                wheat: [245, 222, 179],
                                white: [255, 255, 255],
                                whitesmoke: [245, 245, 245],
                                yellow: [255, 255, 0],
                                yellowgreen: [154, 205, 5]
                            }
                              , u = /rgb\((\d{1,3}),(\d{1,3}),(\d{1,3})\)/
                              , f = []
                              , A = {
                                _isElement: function(t) {
                                    return !(!t || 1 != t.nodeType)
                                },
                                _isFunction: function(t) {
                                    return !!(t && t.constructor && t.call && t.apply)
                                },
                                _isPlainObject: function(t) {
                                    return !!t && t.constructor === Object
                                },
                                _isArray: function(t) {
                                    return "[object Array]" === Object.prototype.toString.call(t)
                                },
                                _isNumber: function(t) {
                                    return "[object Number]" === Object.prototype.toString.call(t) && !isNaN(t) && isFinite(t)
                                },
                                _isString: function(t) {
                                    return "[object String]" === Object.prototype.toString.call(t)
                                },
                                _isBoolean: function(t) {
                                    return "[object Boolean]" === Object.prototype.toString.call(t)
                                },
                                isObject: function(t) {
                                    return t instanceof Object
                                },
                                isValidSelector: function(t) {
                                    if ("string" != typeof t)
                                        return !1;
                                    var e = t[0];
                                    return "#" === e || "." === e || e === e.toUpperCase()
                                },
                                _sign: function(t) {
                                    return 0 === t ? 0 : 0 < t ? 1 : -1
                                },
                                requestAnimFrame: function(t) {
                                    f.push(t),
                                    1 === f.length && requestAnimationFrame(function() {
                                        var t = f;
                                        f = [],
                                        t.forEach(function(t) {
                                            t()
                                        })
                                    })
                                },
                                createCanvasElement: function() {
                                    var t = document.createElement("canvas");
                                    try {
                                        t.style = t.style || {}
                                    } catch (t) {}
                                    return t
                                },
                                createImageElement: function() {
                                    return document.createElement("img")
                                },
                                _isInDocument: function(t) {
                                    for (; t = t.parentNode; )
                                        if (t == document)
                                            return !0;
                                    return !1
                                },
                                _simplifyArray: function(t) {
                                    for (var e, i = [], n = t.length, r = A, o = 0; o < n; o++)
                                        e = t[o],
                                        r._isNumber(e) ? e = Math.round(1e3 * e) / 1e3 : r._isString(e) || (e = e.toString()),
                                        i.push(e);
                                    return i
                                },
                                _urlToImage: function(t, e) {
                                    var i = new n.Image;
                                    i.onload = function() {
                                        e(i)
                                    }
                                    ,
                                    i.src = t
                                },
                                _rgbToHex: function(t, e, i) {
                                    return ((1 << 24) + (t << 16) + (e << 8) + i).toString(16).slice(1)
                                },
                                _hexToRgb: function(t) {
                                    t = t.replace("#", "");
                                    var e = parseInt(t, 16);
                                    return {
                                        r: e >> 16 & 255,
                                        g: e >> 8 & 255,
                                        b: 255 & e
                                    }
                                },
                                getRandomColor: function() {
                                    for (var t = (16777215 * Math.random() << 0).toString(16); t.length < 6; )
                                        t = "0" + t;
                                    return "#" + t
                                },
                                get: function(t, e) {
                                    return void 0 === t ? e : t
                                },
                                getRGB: function(t) {
                                    var e;
                                    return t in d ? {
                                        r: (e = d[t])[0],
                                        g: e[1],
                                        b: e[2]
                                    } : "#" === t[0] ? this._hexToRgb(t.substring(1)) : "rgb(" === t.substr(0, 4) ? (e = u.exec(t.replace(/ /g, "")),
                                    {
                                        r: parseInt(e[1], 10),
                                        g: parseInt(e[2], 10),
                                        b: parseInt(e[3], 10)
                                    }) : {
                                        r: 0,
                                        g: 0,
                                        b: 0
                                    }
                                },
                                colorToRGBA: function(t) {
                                    return t = t || "black",
                                    A._namedColorToRBA(t) || A._hex3ColorToRGBA(t) || A._hex6ColorToRGBA(t) || A._rgbColorToRGBA(t) || A._rgbaColorToRGBA(t) || A._hslColorToRGBA(t)
                                },
                                _namedColorToRBA: function(t) {
                                    var e = d[t.toLowerCase()];
                                    return e ? {
                                        r: e[0],
                                        g: e[1],
                                        b: e[2],
                                        a: 1
                                    } : null
                                },
                                _rgbColorToRGBA: function(t) {
                                    if (0 === t.indexOf("rgb(")) {
                                        var e = (t = t.match(/rgb\(([^)]+)\)/)[1]).split(/ *, */).map(Number);
                                        return {
                                            r: e[0],
                                            g: e[1],
                                            b: e[2],
                                            a: 1
                                        }
                                    }
                                },
                                _rgbaColorToRGBA: function(t) {
                                    if (0 === t.indexOf("rgba(")) {
                                        var e = (t = t.match(/rgba\(([^)]+)\)/)[1]).split(/ *, */).map(Number);
                                        return {
                                            r: e[0],
                                            g: e[1],
                                            b: e[2],
                                            a: e[3]
                                        }
                                    }
                                },
                                _hex6ColorToRGBA: function(t) {
                                    if ("#" === t[0] && 7 === t.length)
                                        return {
                                            r: parseInt(t.slice(1, 3), 16),
                                            g: parseInt(t.slice(3, 5), 16),
                                            b: parseInt(t.slice(5, 7), 16),
                                            a: 1
                                        }
                                },
                                _hex3ColorToRGBA: function(t) {
                                    if ("#" === t[0] && 4 === t.length)
                                        return {
                                            r: parseInt(t[1] + t[1], 16),
                                            g: parseInt(t[2] + t[2], 16),
                                            b: parseInt(t[3] + t[3], 16),
                                            a: 1
                                        }
                                },
                                _hslColorToRGBA: function(t) {
                                    if (/hsl\((\d+),\s*([\d.]+)%,\s*([\d.]+)%\)/g.test(t)) {
                                        var e = /hsl\((\d+),\s*([\d.]+)%,\s*([\d.]+)%\)/g.exec(t)
                                          , i = (e[0],
                                        e.slice(1))
                                          , n = Number(i[0]) / 360
                                          , r = Number(i[1]) / 100
                                          , o = Number(i[2]) / 100
                                          , a = void 0
                                          , s = void 0
                                          , h = void 0;
                                        if (0 == r)
                                            return h = 255 * o,
                                            {
                                                r: Math.round(h),
                                                g: Math.round(h),
                                                b: Math.round(h),
                                                a: 1
                                            };
                                        for (var l = 2 * o - (a = o < .5 ? o * (1 + r) : o + r - o * r), c = [0, 0, 0], d = 0; d < 3; d++)
                                            (s = n + 1 / 3 * -(d - 1)) < 0 && s++,
                                            1 < s && s--,
                                            h = 6 * s < 1 ? l + 6 * (a - l) * s : 2 * s < 1 ? a : 3 * s < 2 ? l + (a - l) * (2 / 3 - s) * 6 : l,
                                            c[d] = 255 * h;
                                        return {
                                            r: Math.round(c[0]),
                                            g: Math.round(c[1]),
                                            b: Math.round(c[2]),
                                            a: 1
                                        }
                                    }
                                },
                                haveIntersection: function(t, e) {
                                    return !(e.x > t.x + t.width || e.x + e.width < t.x || e.y > t.y + t.height || e.y + e.height < t.y)
                                },
                                cloneObject: function(t) {
                                    var e = {};
                                    for (var i in t)
                                        this._isPlainObject(t[i]) ? e[i] = this.cloneObject(t[i]) : this._isArray(t[i]) ? e[i] = this.cloneArray(t[i]) : e[i] = t[i];
                                    return e
                                },
                                cloneArray: function(t) {
                                    return t.slice(0)
                                },
                                _degToRad: function(t) {
                                    return t * h
                                },
                                _radToDeg: function(t) {
                                    return t * l
                                },
                                _getRotation: function(t) {
                                    return G.angleDeg ? A._radToDeg(t) : t
                                },
                                _capitalize: function(t) {
                                    return t.charAt(0).toUpperCase() + t.slice(1)
                                },
                                throw: function(t) {
                                    throw new Error(c + t)
                                },
                                error: function(t) {
                                    console.error(c + t)
                                },
                                warn: function(t) {
                                    G.showWarnings && console.warn("Konva warning: " + t)
                                },
                                extend: function(t, e) {
                                    function i() {
                                        this.constructor = t
                                    }
                                    i.prototype = e.prototype;
                                    var n = t.prototype;
                                    for (var r in t.prototype = new i,
                                    n)
                                        n.hasOwnProperty(r) && (t.prototype[r] = n[r]);
                                    t.__super__ = e.prototype,
                                    t.super = e
                                },
                                _getControlPoints: function(t, e, i, n, r, o, a) {
                                    var s = Math.sqrt(Math.pow(i - t, 2) + Math.pow(n - e, 2))
                                      , h = Math.sqrt(Math.pow(r - i, 2) + Math.pow(o - n, 2))
                                      , l = a * s / (s + h)
                                      , c = a * h / (s + h);
                                    return [i - l * (r - t), n - l * (o - e), i + c * (r - t), n + c * (o - e)]
                                },
                                _expandPoints: function(t, e) {
                                    for (var i, n = t.length, r = [], o = 2; o < n - 2; o += 2)
                                        i = A._getControlPoints(t[o - 2], t[o - 1], t[o], t[o + 1], t[o + 2], t[o + 3], e),
                                        r.push(i[0]),
                                        r.push(i[1]),
                                        r.push(t[o]),
                                        r.push(t[o + 1]),
                                        r.push(i[2]),
                                        r.push(i[3]);
                                    return r
                                },
                                each: function(t, e) {
                                    for (var i in t)
                                        e(i, t[i])
                                },
                                _inRange: function(t, e, i) {
                                    return e <= t && t < i
                                },
                                _getProjectionToSegment: function(t, e, i, n, r, o) {
                                    var a, s, h, l, c = (t - i) * (t - i) + (e - n) * (e - n);
                                    return l = 0 == c ? (a = t,
                                    s = e,
                                    (r - i) * (r - i) + (o - n) * (o - n)) : (h = ((r - t) * (i - t) + (o - e) * (n - e)) / c) < 0 ? ((a = t) - r) * (t - r) + ((s = e) - o) * (e - o) : 1 < h ? ((a = i) - r) * (i - r) + ((s = n) - o) * (n - o) : ((a = t + h * (i - t)) - r) * (a - r) + ((s = e + h * (n - e)) - o) * (s - o),
                                    [a, s, l]
                                },
                                _getProjectionToLine: function(s, h, l) {
                                    var c = A.cloneObject(s)
                                      , d = Number.MAX_VALUE;
                                    return h.forEach(function(t, e) {
                                        var i, n, r, o, a;
                                        !l && e === h.length - 1 || (i = h[(e + 1) % h.length],
                                        r = (n = A._getProjectionToSegment(t.x, t.y, i.x, i.y, s.x, s.y))[0],
                                        o = n[1],
                                        (a = n[2]) < d && (c.x = r,
                                        c.y = o,
                                        d = a))
                                    }),
                                    c
                                },
                                _prepareArrayForTween: function(t, e, i) {
                                    var n, r, o = [], a = [];
                                    for (t.length > e.length && (r = e,
                                    e = t,
                                    t = r),
                                    n = 0; n < t.length; n += 2)
                                        o.push({
                                            x: t[n],
                                            y: t[n + 1]
                                        });
                                    for (n = 0; n < e.length; n += 2)
                                        a.push({
                                            x: e[n],
                                            y: e[n + 1]
                                        });
                                    var s = [];
                                    return a.forEach(function(t) {
                                        var e = A._getProjectionToLine(t, o, i);
                                        s.push(e.x),
                                        s.push(e.y)
                                    }),
                                    s
                                },
                                _prepareToStringify: function(t) {
                                    var e;
                                    for (var i in t.visitedByCircularReferenceRemoval = !0,
                                    t)
                                        if (t.hasOwnProperty(i) && t[i] && "object" == typeof t[i])
                                            if (e = Object.getOwnPropertyDescriptor(t, i),
                                            t[i].visitedByCircularReferenceRemoval || A._isElement(t[i])) {
                                                if (!e.configurable)
                                                    return null;
                                                delete t[i]
                                            } else if (null === A._prepareToStringify(t[i])) {
                                                if (!e.configurable)
                                                    return null;
                                                delete t[i]
                                            }
                                    return delete t.visitedByCircularReferenceRemoval,
                                    t
                                },
                                _assign: function(t, e) {
                                    for (var i in e)
                                        t[i] = e[i];
                                    return t
                                },
                                _getFirstPointerId: function(t) {
                                    return t.touches ? t.changedTouches[0].identifier : 999
                                }
                            };
                            function g(t) {
                                return A._isString(t) ? '"' + t + '"' : "[object Number]" === Object.prototype.toString.call(t) || A._isBoolean(t) ? t : Object.prototype.toString.call(t)
                            }
                            function v(t) {
                                return 255 < t ? 255 : t < 0 ? 0 : Math.round(t)
                            }
                            function y() {
                                if (G.isUnminified)
                                    return function(t, e) {
                                        return A._isNumber(t) || A.warn(g(t) + ' is a not valid value for "' + e + '" attribute. The value should be a number.'),
                                        t
                                    }
                            }
                            function m() {
                                if (G.isUnminified)
                                    return function(t, e) {
                                        return A._isNumber(t) || "auto" === t || A.warn(g(t) + ' is a not valid value for "' + e + '" attribute. The value should be a number or "auto".'),
                                        t
                                    }
                            }
                            function _() {
                                if (G.isUnminified)
                                    return function(t, e) {
                                        return A._isString(t) || A.warn(g(t) + ' is a not valid value for "' + e + '" attribute. The value should be a string.'),
                                        t
                                    }
                            }
                            function b() {
                                if (G.isUnminified)
                                    return function(t, e) {
                                        return !0 === t || !1 === t || A.warn(g(t) + ' is a not valid value for "' + e + '" attribute. The value should be a boolean.'),
                                        t
                                    }
                            }
                            var x = "get"
                              , S = "set"
                              , w = {
                                addGetterSetter: function(t, e, i, n, r) {
                                    w.addGetter(t, e, i),
                                    w.addSetter(t, e, n, r),
                                    w.addOverloadedGetterSetter(t, e)
                                },
                                addGetter: function(t, e, i) {
                                    var n = x + A._capitalize(e);
                                    t.prototype[n] = t.prototype[n] || function() {
                                        var t = this.attrs[e];
                                        return void 0 === t ? i : t
                                    }
                                },
                                addSetter: function(t, e, i, n) {
                                    var r = S + A._capitalize(e);
                                    t.prototype[r] || w.overWriteSetter(t, e, i, n)
                                },
                                overWriteSetter: function(t, e, i, n) {
                                    var r = S + A._capitalize(e);
                                    t.prototype[r] = function(t) {
                                        return i && null != t && (t = i.call(this, t, e)),
                                        this._setAttr(e, t),
                                        n && n.call(this),
                                        this
                                    }
                                },
                                addComponentsGetterSetter: function(t, n, e, r, o) {
                                    var i, a, s = e.length, h = A._capitalize, l = x + h(n), c = S + h(n);
                                    t.prototype[l] = function() {
                                        var t = {};
                                        for (i = 0; i < s; i++)
                                            t[a = e[i]] = this.getAttr(n + h(a));
                                        return t
                                    }
                                    ;
                                    var d = function(i) {
                                        if (G.isUnminified)
                                            return function(t, e) {
                                                return A.isObject(t) || A.warn(g(t) + ' is a not valid value for "' + e + '" attribute. The value should be an object with properties ' + i),
                                                t
                                            }
                                    }(e);
                                    t.prototype[c] = function(t) {
                                        var e, i = this.attrs[n];
                                        for (e in r && (t = r.call(this, t)),
                                        d && d.call(this, t, n),
                                        t)
                                            t.hasOwnProperty(e) && this._setAttr(n + h(e), t[e]);
                                        return this._fireChangeEvent(n, i, t),
                                        o && o.call(this),
                                        this
                                    }
                                    ,
                                    w.addOverloadedGetterSetter(t, n)
                                },
                                addOverloadedGetterSetter: function(t, e) {
                                    var i = A._capitalize(e)
                                      , n = S + i
                                      , r = x + i;
                                    t.prototype[e] = function() {
                                        return arguments.length ? (this[n](arguments[0]),
                                        this) : this[r]()
                                    }
                                },
                                addDeprecatedGetterSetter: function(t, e, i, n) {
                                    A.error("Adding deprecated " + e);
                                    var r = x + A._capitalize(e)
                                      , o = e + " property is deprecated and will be removed soon. Look at Konva change log for more information.";
                                    t.prototype[r] = function() {
                                        A.error(o);
                                        var t = this.attrs[e];
                                        return void 0 === t ? i : t
                                    }
                                    ,
                                    w.addSetter(t, e, n, function() {
                                        A.error(o)
                                    }),
                                    w.addOverloadedGetterSetter(t, e)
                                },
                                backCompat: function(a, t) {
                                    A.each(t, function(t, e) {
                                        var i = a.prototype[e]
                                          , n = x + A._capitalize(t)
                                          , r = S + A._capitalize(t);
                                        function o() {
                                            i.apply(this, arguments),
                                            A.error('"' + t + '" method is deprecated and will be removed soon. Use ""' + e + '" instead.')
                                        }
                                        a.prototype[t] = o,
                                        a.prototype[n] = o,
                                        a.prototype[r] = o
                                    })
                                },
                                afterSetFilter: function() {
                                    this._filterUpToDate = !1
                                }
                            }
                              , C = function(t, e) {
                                return (C = Object.setPrototypeOf || {
                                    __proto__: []
                                }instanceof Array && function(t, e) {
                                    t.__proto__ = e
                                }
                                || function(t, e) {
                                    for (var i in e)
                                        e.hasOwnProperty(i) && (t[i] = e[i])
                                }
                                )(t, e)
                            };
                            function P(t, e) {
                                function i() {
                                    this.constructor = t
                                }
                                C(t, e),
                                t.prototype = null === e ? Object.create(e) : (i.prototype = e.prototype,
                                new i)
                            }
                            var k = function() {
                                return (k = Object.assign || function(t) {
                                    for (var e, i = 1, n = arguments.length; i < n; i++)
                                        for (var r in e = arguments[i])
                                            Object.prototype.hasOwnProperty.call(e, r) && (t[r] = e[r]);
                                    return t
                                }
                                ).apply(this, arguments)
                            };
                            var T = ["arc", "arcTo", "beginPath", "bezierCurveTo", "clearRect", "clip", "closePath", "createLinearGradient", "createPattern", "createRadialGradient", "drawImage", "ellipse", "fill", "fillText", "getImageData", "createImageData", "lineTo", "moveTo", "putImageData", "quadraticCurveTo", "rect", "restore", "rotate", "save", "scale", "setLineDash", "setTransform", "stroke", "strokeText", "transform", "translate"]
                              , M = (R.prototype.fillShape = function(t) {
                                t.fillEnabled() && this._fill(t)
                            }
                            ,
                            R.prototype._fill = function(t) {}
                            ,
                            R.prototype.strokeShape = function(t) {
                                t.hasStroke() && this._stroke(t)
                            }
                            ,
                            R.prototype._stroke = function(t) {}
                            ,
                            R.prototype.fillStrokeShape = function(t) {
                                this.fillShape(t),
                                this.strokeShape(t)
                            }
                            ,
                            R.prototype.getTrace = function(t) {
                                for (var e, i, n, r = this.traceArr, o = r.length, a = "", s = 0; s < o; s++)
                                    (i = (e = r[s]).method) ? (n = e.args,
                                    a += i,
                                    t ? a += "()" : A._isArray(n[0]) ? a += "([" + n.join(",") + "])" : a += "(" + n.join(",") + ")") : (a += e.property,
                                    t || (a += "=" + e.val)),
                                    a += ";";
                                return a
                            }
                            ,
                            R.prototype.clearTrace = function() {
                                this.traceArr = []
                            }
                            ,
                            R.prototype._trace = function(t) {
                                var e = this.traceArr;
                                e.push(t),
                                100 <= e.length && e.shift()
                            }
                            ,
                            R.prototype.reset = function() {
                                var t = this.getCanvas().getPixelRatio();
                                this.setTransform(+t, 0, 0, +t, 0, 0)
                            }
                            ,
                            R.prototype.getCanvas = function() {
                                return this.canvas
                            }
                            ,
                            R.prototype.clear = function(t) {
                                var e = this.getCanvas();
                                t ? this.clearRect(t.x || 0, t.y || 0, t.width || 0, t.height || 0) : this.clearRect(0, 0, e.getWidth() / e.pixelRatio, e.getHeight() / e.pixelRatio)
                            }
                            ,
                            R.prototype._applyLineCap = function(t) {
                                var e = t.getLineCap();
                                e && this.setAttr("lineCap", e)
                            }
                            ,
                            R.prototype._applyOpacity = function(t) {
                                var e = t.getAbsoluteOpacity();
                                1 !== e && this.setAttr("globalAlpha", e)
                            }
                            ,
                            R.prototype._applyLineJoin = function(t) {
                                var e = t.attrs.lineJoin;
                                e && this.setAttr("lineJoin", e)
                            }
                            ,
                            R.prototype.setAttr = function(t, e) {
                                this._context[t] = e
                            }
                            ,
                            R.prototype.arc = function(t, e, i, n, r, o) {
                                this._context.arc(t, e, i, n, r, o)
                            }
                            ,
                            R.prototype.arcTo = function(t, e, i, n, r) {
                                this._context.arcTo(t, e, i, n, r)
                            }
                            ,
                            R.prototype.beginPath = function() {
                                this._context.beginPath()
                            }
                            ,
                            R.prototype.bezierCurveTo = function(t, e, i, n, r, o) {
                                this._context.bezierCurveTo(t, e, i, n, r, o)
                            }
                            ,
                            R.prototype.clearRect = function(t, e, i, n) {
                                this._context.clearRect(t, e, i, n)
                            }
                            ,
                            R.prototype.clip = function() {
                                this._context.clip()
                            }
                            ,
                            R.prototype.closePath = function() {
                                this._context.closePath()
                            }
                            ,
                            R.prototype.createImageData = function(t, e) {
                                var i = arguments;
                                return 2 === i.length ? this._context.createImageData(t, e) : 1 === i.length ? this._context.createImageData(t) : void 0
                            }
                            ,
                            R.prototype.createLinearGradient = function(t, e, i, n) {
                                return this._context.createLinearGradient(t, e, i, n)
                            }
                            ,
                            R.prototype.createPattern = function(t, e) {
                                return this._context.createPattern(t, e)
                            }
                            ,
                            R.prototype.createRadialGradient = function(t, e, i, n, r, o) {
                                return this._context.createRadialGradient(t, e, i, n, r, o)
                            }
                            ,
                            R.prototype.drawImage = function(t, e, i, n, r, o, a, s, h) {
                                var l = arguments
                                  , c = this._context;
                                3 === l.length ? c.drawImage(t, e, i) : 5 === l.length ? c.drawImage(t, e, i, n, r) : 9 === l.length && c.drawImage(t, e, i, n, r, o, a, s, h)
                            }
                            ,
                            R.prototype.ellipse = function(t, e, i, n, r, o, a, s) {
                                this._context.ellipse(t, e, i, n, r, o, a, s)
                            }
                            ,
                            R.prototype.isPointInPath = function(t, e) {
                                return this._context.isPointInPath(t, e)
                            }
                            ,
                            R.prototype.fill = function() {
                                this._context.fill()
                            }
                            ,
                            R.prototype.fillRect = function(t, e, i, n) {
                                this._context.fillRect(t, e, i, n)
                            }
                            ,
                            R.prototype.strokeRect = function(t, e, i, n) {
                                this._context.strokeRect(t, e, i, n)
                            }
                            ,
                            R.prototype.fillText = function(t, e, i) {
                                this._context.fillText(t, e, i)
                            }
                            ,
                            R.prototype.measureText = function(t) {
                                return this._context.measureText(t)
                            }
                            ,
                            R.prototype.getImageData = function(t, e, i, n) {
                                return this._context.getImageData(t, e, i, n)
                            }
                            ,
                            R.prototype.lineTo = function(t, e) {
                                this._context.lineTo(t, e)
                            }
                            ,
                            R.prototype.moveTo = function(t, e) {
                                this._context.moveTo(t, e)
                            }
                            ,
                            R.prototype.rect = function(t, e, i, n) {
                                this._context.rect(t, e, i, n)
                            }
                            ,
                            R.prototype.putImageData = function(t, e, i) {
                                this._context.putImageData(t, e, i)
                            }
                            ,
                            R.prototype.quadraticCurveTo = function(t, e, i, n) {
                                this._context.quadraticCurveTo(t, e, i, n)
                            }
                            ,
                            R.prototype.restore = function() {
                                this._context.restore()
                            }
                            ,
                            R.prototype.rotate = function(t) {
                                this._context.rotate(t)
                            }
                            ,
                            R.prototype.save = function() {
                                this._context.save()
                            }
                            ,
                            R.prototype.scale = function(t, e) {
                                this._context.scale(t, e)
                            }
                            ,
                            R.prototype.setLineDash = function(t) {
                                this._context.setLineDash ? this._context.setLineDash(t) : "mozDash"in this._context ? this._context.mozDash = t : "webkitLineDash"in this._context && (this._context.webkitLineDash = t)
                            }
                            ,
                            R.prototype.getLineDash = function() {
                                return this._context.getLineDash()
                            }
                            ,
                            R.prototype.setTransform = function(t, e, i, n, r, o) {
                                this._context.setTransform(t, e, i, n, r, o)
                            }
                            ,
                            R.prototype.stroke = function() {
                                this._context.stroke()
                            }
                            ,
                            R.prototype.strokeText = function(t, e, i, n) {
                                this._context.strokeText(t, e, i, n)
                            }
                            ,
                            R.prototype.transform = function(t, e, i, n, r, o) {
                                this._context.transform(t, e, i, n, r, o)
                            }
                            ,
                            R.prototype.translate = function(t, e) {
                                this._context.translate(t, e)
                            }
                            ,
                            R.prototype._enableTrace = function() {
                                for (var n, r = this, t = T.length, o = A._simplifyArray, i = this.setAttr, e = function(t) {
                                    var e, i = r[t];
                                    r[t] = function() {
                                        return n = o(Array.prototype.slice.call(arguments, 0)),
                                        e = i.apply(r, arguments),
                                        r._trace({
                                            method: t,
                                            args: n
                                        }),
                                        e
                                    }
                                }, a = 0; a < t; a++)
                                    e(T[a]);
                                r.setAttr = function() {
                                    i.apply(r, arguments);
                                    var t = arguments[0]
                                      , e = arguments[1];
                                    "shadowOffsetX" !== t && "shadowOffsetY" !== t && "shadowBlur" !== t || (e /= this.canvas.getPixelRatio()),
                                    r._trace({
                                        property: t,
                                        val: e
                                    })
                                }
                            }
                            ,
                            R.prototype._applyGlobalCompositeOperation = function(t) {
                                var e = t.getGlobalCompositeOperation();
                                "source-over" !== e && this.setAttr("globalCompositeOperation", e)
                            }
                            ,
                            R);
                            function R(t) {
                                this.canvas = t,
                                this._context = t._canvas.getContext("2d"),
                                G.enableTrace && (this.traceArr = [],
                                this._enableTrace())
                            }
                            ["fillStyle", "strokeStyle", "shadowColor", "shadowBlur", "shadowOffsetX", "shadowOffsetY", "lineCap", "lineDashOffset", "lineJoin", "lineWidth", "miterLimit", "font", "textAlign", "textBaseline", "globalAlpha", "globalCompositeOperation", "imageSmoothingEnabled"].forEach(function(e) {
                                Object.defineProperty(M.prototype, e, {
                                    get: function() {
                                        return this._context[e]
                                    },
                                    set: function(t) {
                                        this._context[e] = t
                                    }
                                })
                            });
                            var E, I = (P(L, E = M),
                            L.prototype._fillColor = function(t) {
                                var e = t.fill();
                                this.setAttr("fillStyle", e),
                                t._fillFunc(this)
                            }
                            ,
                            L.prototype._fillPattern = function(t) {
                                var e = t.getFillPatternX()
                                  , i = t.getFillPatternY()
                                  , n = G.getAngle(t.getFillPatternRotation())
                                  , r = t.getFillPatternOffsetX()
                                  , o = t.getFillPatternOffsetY()
                                  , a = t.getFillPatternScaleX()
                                  , s = t.getFillPatternScaleY();
                                (e || i) && this.translate(e || 0, i || 0),
                                n && this.rotate(n),
                                (a || s) && this.scale(a, s),
                                (r || o) && this.translate(-1 * r, -1 * o),
                                this.setAttr("fillStyle", t._getFillPattern()),
                                t._fillFunc(this)
                            }
                            ,
                            L.prototype._fillLinearGradient = function(t) {
                                var e = t._getLinearGradient();
                                e && (this.setAttr("fillStyle", e),
                                t._fillFunc(this))
                            }
                            ,
                            L.prototype._fillRadialGradient = function(t) {
                                var e = t._getRadialGradient();
                                e && (this.setAttr("fillStyle", e),
                                t._fillFunc(this))
                            }
                            ,
                            L.prototype._fill = function(t) {
                                var e, i, n, r = t.fill(), o = t.getFillPriority();
                                r && "color" === o ? this._fillColor(t) : (e = t.getFillPatternImage()) && "pattern" === o ? this._fillPattern(t) : (i = t.getFillLinearGradientColorStops()) && "linear-gradient" === o ? this._fillLinearGradient(t) : (n = t.getFillRadialGradientColorStops()) && "radial-gradient" === o ? this._fillRadialGradient(t) : r ? this._fillColor(t) : e ? this._fillPattern(t) : i ? this._fillLinearGradient(t) : n && this._fillRadialGradient(t)
                            }
                            ,
                            L.prototype._strokeLinearGradient = function(t) {
                                var e = t.getStrokeLinearGradientStartPoint()
                                  , i = t.getStrokeLinearGradientEndPoint()
                                  , n = t.getStrokeLinearGradientColorStops()
                                  , r = this.createLinearGradient(e.x, e.y, i.x, i.y);
                                if (n) {
                                    for (var o = 0; o < n.length; o += 2)
                                        r.addColorStop(n[o], n[o + 1]);
                                    this.setAttr("strokeStyle", r)
                                }
                            }
                            ,
                            L.prototype._stroke = function(t) {
                                var e, i = t.dash(), n = t.getStrokeScaleEnabled();
                                t.hasStroke() && (n || (this.save(),
                                e = this.getCanvas().getPixelRatio(),
                                this.setTransform(e, 0, 0, e, 0, 0)),
                                this._applyLineCap(t),
                                i && t.dashEnabled() && (this.setLineDash(i),
                                this.setAttr("lineDashOffset", t.dashOffset())),
                                this.setAttr("lineWidth", t.strokeWidth()),
                                t.getShadowForStrokeEnabled() || this.setAttr("shadowColor", "rgba(0,0,0,0)"),
                                t.getStrokeLinearGradientColorStops() ? this._strokeLinearGradient(t) : this.setAttr("strokeStyle", t.stroke()),
                                t._strokeFunc(this),
                                n || this.restore())
                            }
                            ,
                            L.prototype._applyShadow = function(t) {
                                var e = A
                                  , i = e.get(t.getShadowRGBA(), "black")
                                  , n = e.get(t.getShadowBlur(), 5)
                                  , r = e.get(t.getShadowOffset(), {
                                    x: 0,
                                    y: 0
                                })
                                  , o = t.getAbsoluteScale()
                                  , a = this.canvas.getPixelRatio()
                                  , s = o.x * a
                                  , h = o.y * a;
                                this.setAttr("shadowColor", i),
                                this.setAttr("shadowBlur", n * Math.min(Math.abs(s), Math.abs(h))),
                                this.setAttr("shadowOffsetX", r.x * s),
                                this.setAttr("shadowOffsetY", r.y * h)
                            }
                            ,
                            L);
                            function L() {
                                return null !== E && E.apply(this, arguments) || this
                            }
                            var D, O, F = (P(B, D = M),
                            B.prototype._fill = function(t) {
                                this.save(),
                                this.setAttr("fillStyle", t.colorKey),
                                t._fillFuncHit(this),
                                this.restore()
                            }
                            ,
                            B.prototype.strokeShape = function(t) {
                                t.hasHitStroke() && this._stroke(t)
                            }
                            ,
                            B.prototype._stroke = function(t) {
                                var e, i, n, r;
                                t.hasHitStroke() && ((e = t.getStrokeScaleEnabled()) || (this.save(),
                                i = this.getCanvas().getPixelRatio(),
                                this.setTransform(i, 0, 0, i, 0, 0)),
                                this._applyLineCap(t),
                                r = "auto" === (n = t.hitStrokeWidth()) ? t.strokeWidth() : n,
                                this.setAttr("lineWidth", r),
                                this.setAttr("strokeStyle", t.colorKey),
                                t._strokeFuncHit(this),
                                e || this.restore())
                            }
                            ,
                            B);
                            function B() {
                                return null !== D && D.apply(this, arguments) || this
                            }
                            var N = (z.prototype.getContext = function() {
                                return this.context
                            }
                            ,
                            z.prototype.getPixelRatio = function() {
                                return this.pixelRatio
                            }
                            ,
                            z.prototype.setPixelRatio = function(t) {
                                var e = this.pixelRatio;
                                this.pixelRatio = t,
                                this.setSize(this.getWidth() / e, this.getHeight() / e)
                            }
                            ,
                            z.prototype.setWidth = function(t) {
                                this.width = this._canvas.width = t * this.pixelRatio,
                                this._canvas.style.width = t + "px";
                                var e = this.pixelRatio;
                                this.getContext()._context.scale(e, e)
                            }
                            ,
                            z.prototype.setHeight = function(t) {
                                this.height = this._canvas.height = t * this.pixelRatio,
                                this._canvas.style.height = t + "px";
                                var e = this.pixelRatio;
                                this.getContext()._context.scale(e, e)
                            }
                            ,
                            z.prototype.getWidth = function() {
                                return this.width
                            }
                            ,
                            z.prototype.getHeight = function() {
                                return this.height
                            }
                            ,
                            z.prototype.setSize = function(t, e) {
                                this.setWidth(t || 0),
                                this.setHeight(e || 0)
                            }
                            ,
                            z.prototype.toDataURL = function(t, e) {
                                try {
                                    return this._canvas.toDataURL(t, e)
                                } catch (t) {
                                    try {
                                        return this._canvas.toDataURL()
                                    } catch (t) {
                                        return A.error("Unable to get data URL. " + t.message + " For more info read https://konvajs.org/docs/posts/Tainted_Canvas.html."),
                                        ""
                                    }
                                }
                            }
                            ,
                            z);
                            function z(t) {
                                this.pixelRatio = 1,
                                this.width = 0,
                                this.height = 0,
                                this.isCache = !1;
                                var e = (t || {}).pixelRatio || G.pixelRatio || function() {
                                    if (O)
                                        return O;
                                    var t = A.createCanvasElement().getContext("2d");
                                    return O = (G._global.devicePixelRatio || 1) / (t.webkitBackingStorePixelRatio || t.mozBackingStorePixelRatio || t.msBackingStorePixelRatio || t.oBackingStorePixelRatio || t.backingStorePixelRatio || 1)
                                }();
                                this.pixelRatio = e,
                                this._canvas = A.createCanvasElement(),
                                this._canvas.style.padding = "0",
                                this._canvas.style.margin = "0",
                                this._canvas.style.border = "0",
                                this._canvas.style.background = "transparent",
                                this._canvas.style.position = "absolute",
                                this._canvas.style.top = "0",
                                this._canvas.style.left = "0"
                            }
                            w.addGetterSetter(N, "pixelRatio", void 0, y());
                            var W, H = (P(Y, W = N),
                            Y);
                            function Y(t) {
                                void 0 === t && (t = {
                                    width: 0,
                                    height: 0
                                });
                                var e = W.call(this, t) || this;
                                return e.context = new I(e),
                                e.setSize(t.width, t.height),
                                e
                            }
                            var X, j = (P(U, X = N),
                            U);
                            function U(t) {
                                void 0 === t && (t = {
                                    width: 0,
                                    height: 0
                                });
                                var e = X.call(this, t) || this;
                                return e.hitCanvas = !0,
                                e.context = new F(e),
                                e.setSize(t.width, t.height),
                                e
                            }
                            var q = {
                                get isDragging() {
                                    var e = !1;
                                    return q._dragElements.forEach(function(t) {
                                        "dragging" === t.dragStatus && (e = !0)
                                    }),
                                    e
                                },
                                justDragged: !1,
                                get node() {
                                    var e;
                                    return q._dragElements.forEach(function(t) {
                                        e = t.node
                                    }),
                                    e
                                },
                                _dragElements: new Map,
                                _drag: function(a) {
                                    var s = [];
                                    q._dragElements.forEach(function(e, t) {
                                        var i = e.node
                                          , n = i.getStage();
                                        n.setPointersPositions(a),
                                        void 0 === e.pointerId && (e.pointerId = A._getFirstPointerId(a));
                                        var r = n._changedPointerPositions.find(function(t) {
                                            return t.id === e.pointerId
                                        });
                                        if (r) {
                                            if ("dragging" !== e.dragStatus) {
                                                var o = i.dragDistance();
                                                if (Math.max(Math.abs(r.x - e.startPointerPos.x), Math.abs(r.y - e.startPointerPos.y)) < o)
                                                    return;
                                                if (i.startDrag({
                                                    evt: a
                                                }),
                                                !i.isDragging())
                                                    return
                                            }
                                            i._setDragPosition(a, e),
                                            s.push(i)
                                        }
                                    }),
                                    s.forEach(function(t) {
                                        t.fire("dragmove", {
                                            type: "dragmove",
                                            target: t,
                                            evt: a
                                        }, !0)
                                    })
                                },
                                _endDragBefore: function(r) {
                                    q._dragElements.forEach(function(e, t) {
                                        var i, n = e.node.getStage();
                                        r && n.setPointersPositions(r),
                                        n._changedPointerPositions.find(function(t) {
                                            return t.id === e.pointerId
                                        }) && ("dragging" !== e.dragStatus && "stopped" !== e.dragStatus || (q.justDragged = !0,
                                        G.listenClickTap = !1,
                                        e.dragStatus = "stopped"),
                                        (i = e.node.getLayer() || e.node instanceof G.Stage && e.node) && i.draw())
                                    })
                                },
                                _endDragAfter: function(i) {
                                    q._dragElements.forEach(function(t, e) {
                                        "stopped" === t.dragStatus && t.node.fire("dragend", {
                                            type: "dragend",
                                            target: t.node,
                                            evt: i
                                        }, !0),
                                        "dragging" !== t.dragStatus && q._dragElements.delete(e)
                                    })
                                }
                            };
                            G.isBrowser && (window.addEventListener("mouseup", q._endDragBefore, !0),
                            window.addEventListener("touchend", q._endDragBefore, !0),
                            window.addEventListener("mousemove", q._drag),
                            window.addEventListener("touchmove", q._drag),
                            window.addEventListener("mouseup", q._endDragAfter, !1),
                            window.addEventListener("touchend", q._endDragAfter, !1));
                            function K(t, e) {
                                t && Q[t] === e && delete Q[t]
                            }
                            function V(t, e) {
                                if (t) {
                                    var i = J[t];
                                    if (i) {
                                        for (var n = 0; n < i.length; n++) {
                                            i[n]._id === e && i.splice(n, 1)
                                        }
                                        0 === i.length && delete J[t]
                                    }
                                }
                            }
                            var Q = {}
                              , J = {}
                              , Z = "absoluteOpacity"
                              , $ = "absoluteTransform"
                              , tt = "absoluteScale"
                              , et = "canvas"
                              , it = "listening"
                              , nt = "mouseenter"
                              , rt = "mouseleave"
                              , ot = "transform"
                              , at = "visible"
                              , st = ["xChange.konva", "yChange.konva", "scaleXChange.konva", "scaleYChange.konva", "skewXChange.konva", "skewYChange.konva", "rotationChange.konva", "offsetXChange.konva", "offsetYChange.konva", "transformsEnabledChange.konva"].join(" ")
                              , ht = new o
                              , lt = 1
                              , ct = (dt.prototype.hasChildren = function() {
                                return !1
                            }
                            ,
                            dt.prototype.getChildren = function() {
                                return ht
                            }
                            ,
                            dt.prototype._clearCache = function(t) {
                                t !== ot && t !== $ || !this._cache.get(t) ? t ? this._cache.delete(t) : this._cache.clear() : this._cache.get(t).dirty = !0
                            }
                            ,
                            dt.prototype._getCache = function(t, e) {
                                var i = this._cache.get(t);
                                return void 0 !== i && (t !== ot && t !== $ || !0 !== i.dirty) || (i = e.call(this),
                                this._cache.set(t, i)),
                                i
                            }
                            ,
                            dt.prototype._calculate = function(t, e, i) {
                                var n, r = this;
                                return this._attachedDepsListeners.get(t) || (n = e.map(function(t) {
                                    return t + "Change.konva"
                                }).join(" "),
                                this.on(n, function() {
                                    r._clearCache(t)
                                }),
                                this._attachedDepsListeners.set(t, !0)),
                                this._getCache(t, i)
                            }
                            ,
                            dt.prototype._getCanvasCache = function() {
                                return this._cache.get(et)
                            }
                            ,
                            dt.prototype._clearSelfAndDescendantCache = function(e, t) {
                                this._clearCache(e),
                                t && e === $ && this.fire("_clearTransformCache"),
                                this.isCached() || this.children && this.children.each(function(t) {
                                    t._clearSelfAndDescendantCache(e, !0)
                                })
                            }
                            ,
                            dt.prototype.clearCache = function() {
                                return this._cache.delete(et),
                                this._clearSelfAndDescendantCache(),
                                this
                            }
                            ,
                            dt.prototype.cache = function(t) {
                                var e = t || {}
                                  , i = {};
                                void 0 !== e.x && void 0 !== e.y && void 0 !== e.width && void 0 !== e.height || (i = this.getClientRect({
                                    skipTransform: !0,
                                    relativeTo: this.getParent()
                                }));
                                var n = Math.ceil(e.width || i.width)
                                  , r = Math.ceil(e.height || i.height)
                                  , o = e.pixelRatio
                                  , a = void 0 === e.x ? i.x : e.x
                                  , s = void 0 === e.y ? i.y : e.y
                                  , h = e.offset || 0
                                  , l = e.drawBorder || !1;
                                if (n && r) {
                                    a -= h,
                                    s -= h;
                                    var c = new H({
                                        pixelRatio: o,
                                        width: n += 2 * h,
                                        height: r += 2 * h
                                    })
                                      , d = new H({
                                        pixelRatio: o,
                                        width: 0,
                                        height: 0
                                    })
                                      , p = new j({
                                        pixelRatio: 1,
                                        width: n,
                                        height: r
                                    })
                                      , u = c.getContext()
                                      , f = p.getContext();
                                    return p.isCache = !0,
                                    c.isCache = !0,
                                    this._cache.delete("canvas"),
                                    (this._filterUpToDate = !1) === e.imageSmoothingEnabled && (c.getContext()._context.imageSmoothingEnabled = !1,
                                    d.getContext()._context.imageSmoothingEnabled = !1),
                                    u.save(),
                                    f.save(),
                                    u.translate(-a, -s),
                                    f.translate(-a, -s),
                                    this._isUnderCache = !0,
                                    this._clearSelfAndDescendantCache(Z),
                                    this._clearSelfAndDescendantCache(tt),
                                    this.drawScene(c, this),
                                    this.drawHit(p, this),
                                    this._isUnderCache = !1,
                                    u.restore(),
                                    f.restore(),
                                    l && (u.save(),
                                    u.beginPath(),
                                    u.rect(0, 0, n, r),
                                    u.closePath(),
                                    u.setAttr("strokeStyle", "red"),
                                    u.setAttr("lineWidth", 5),
                                    u.stroke(),
                                    u.restore()),
                                    this._cache.set(et, {
                                        scene: c,
                                        filter: d,
                                        hit: p,
                                        x: a,
                                        y: s
                                    }),
                                    this
                                }
                                A.error("Can not cache the node. Width or height of the node equals 0. Caching is skipped.")
                            }
                            ,
                            dt.prototype.isCached = function() {
                                return this._cache.has("canvas")
                            }
                            ,
                            dt.prototype.getClientRect = function(t) {
                                throw new Error('abstract "getClientRect" method call')
                            }
                            ,
                            dt.prototype._transformedRect = function(t, e) {
                                var i, n, r, o, a = [{
                                    x: t.x,
                                    y: t.y
                                }, {
                                    x: t.x + t.width,
                                    y: t.y
                                }, {
                                    x: t.x + t.width,
                                    y: t.y + t.height
                                }, {
                                    x: t.x,
                                    y: t.y + t.height
                                }], s = this.getAbsoluteTransform(e);
                                return a.forEach(function(t) {
                                    var e = s.point(t);
                                    void 0 === i && (i = r = e.x,
                                    n = o = e.y),
                                    i = Math.min(i, e.x),
                                    n = Math.min(n, e.y),
                                    r = Math.max(r, e.x),
                                    o = Math.max(o, e.y)
                                }),
                                {
                                    x: i,
                                    y: n,
                                    width: r - i,
                                    height: o - n
                                }
                            }
                            ,
                            dt.prototype._drawCachedSceneCanvas = function(t) {
                                t.save(),
                                t._applyOpacity(this),
                                t._applyGlobalCompositeOperation(this);
                                var e = this._getCanvasCache();
                                t.translate(e.x, e.y);
                                var i = this._getCachedSceneCanvas()
                                  , n = i.pixelRatio;
                                t.drawImage(i._canvas, 0, 0, i.width / n, i.height / n),
                                t.restore()
                            }
                            ,
                            dt.prototype._drawCachedHitCanvas = function(t) {
                                var e = this._getCanvasCache()
                                  , i = e.hit;
                                t.save(),
                                t.translate(e.x, e.y),
                                t.drawImage(i._canvas, 0, 0),
                                t.restore()
                            }
                            ,
                            dt.prototype._getCachedSceneCanvas = function() {
                                var t, e, i, n, r = this.filters(), o = this._getCanvasCache(), a = o.scene, s = o.filter, h = s.getContext();
                                if (r) {
                                    if (!this._filterUpToDate) {
                                        var l = a.pixelRatio;
                                        s.setSize(a.width / a.pixelRatio, a.height / a.pixelRatio);
                                        try {
                                            for (t = r.length,
                                            h.clear(),
                                            h.drawImage(a._canvas, 0, 0, a.getWidth() / l, a.getHeight() / l),
                                            e = h.getImageData(0, 0, s.getWidth(), s.getHeight()),
                                            i = 0; i < t; i++)
                                                "function" == typeof (n = r[i]) ? (n.call(this, e),
                                                h.putImageData(e, 0, 0)) : A.error("Filter should be type of function, but got " + typeof n + " instead. Please check correct filters")
                                        } catch (t) {
                                            A.error("Unable to apply filter. " + t.message + " This post my help you https://konvajs.org/docs/posts/Tainted_Canvas.html.")
                                        }
                                        this._filterUpToDate = !0
                                    }
                                    return s
                                }
                                return a
                            }
                            ,
                            dt.prototype.on = function(t, e) {
                                if (3 === arguments.length)
                                    return this._delegate.apply(this, arguments);
                                for (var i, n, r, o = t.split(" "), a = o.length, s = 0; s < a; s++)
                                    n = (i = o[s].split("."))[0],
                                    r = i[1] || "",
                                    this.eventListeners[n] || (this.eventListeners[n] = []),
                                    this.eventListeners[n].push({
                                        name: r,
                                        handler: e
                                    });
                                return this
                            }
                            ,
                            dt.prototype.off = function(t, e) {
                                var i, n, r, o, a, s = (t || "").split(" "), h = s.length;
                                if (!t)
                                    for (n in this.eventListeners)
                                        this._off(n);
                                for (i = 0; i < h; i++)
                                    if (o = (r = s[i].split("."))[0],
                                    a = r[1],
                                    o)
                                        this.eventListeners[o] && this._off(o, a, e);
                                    else
                                        for (n in this.eventListeners)
                                            this._off(n, a, e);
                                return this
                            }
                            ,
                            dt.prototype.dispatchEvent = function(t) {
                                var e = {
                                    target: this,
                                    type: t.type,
                                    evt: t
                                };
                                return this.fire(t.type, e),
                                this
                            }
                            ,
                            dt.prototype.addEventListener = function(t, e) {
                                return this.on(t, function(t) {
                                    e.call(this, t.evt)
                                }),
                                this
                            }
                            ,
                            dt.prototype.removeEventListener = function(t) {
                                return this.off(t),
                                this
                            }
                            ,
                            dt.prototype._delegate = function(t, n, r) {
                                var o = this;
                                this.on(t, function(t) {
                                    for (var e = t.target.findAncestors(n, !0, o), i = 0; i < e.length; i++)
                                        (t = A.cloneObject(t)).currentTarget = e[i],
                                        r.call(e[i], t)
                                })
                            }
                            ,
                            dt.prototype.remove = function() {
                                return this.isDragging() && this.stopDrag(),
                                q._dragElements.delete(this._id),
                                this._remove(),
                                this
                            }
                            ,
                            dt.prototype._clearCaches = function() {
                                this._clearSelfAndDescendantCache($),
                                this._clearSelfAndDescendantCache(Z),
                                this._clearSelfAndDescendantCache(tt),
                                this._clearSelfAndDescendantCache("stage"),
                                this._clearSelfAndDescendantCache(at),
                                this._clearSelfAndDescendantCache(it)
                            }
                            ,
                            dt.prototype._remove = function() {
                                this._clearCaches();
                                var t = this.getParent();
                                t && t.children && (t.children.splice(this.index, 1),
                                t._setChildrenIndices(),
                                this.parent = null)
                            }
                            ,
                            dt.prototype.destroy = function() {
                                K(this.id(), this);
                                for (var t = (this.name() || "").split(/\s/g), e = 0; e < t.length; e++) {
                                    var i = t[e];
                                    V(i, this._id)
                                }
                                return this.remove(),
                                this
                            }
                            ,
                            dt.prototype.getAttr = function(t) {
                                var e = "get" + A._capitalize(t);
                                return A._isFunction(this[e]) ? this[e]() : this.attrs[t]
                            }
                            ,
                            dt.prototype.getAncestors = function() {
                                for (var t = this.getParent(), e = new o; t; )
                                    e.push(t),
                                    t = t.getParent();
                                return e
                            }
                            ,
                            dt.prototype.getAttrs = function() {
                                return this.attrs || {}
                            }
                            ,
                            dt.prototype.setAttrs = function(i) {
                                var n = this;
                                return this._batchTransformChanges(function() {
                                    var t, e;
                                    if (!i)
                                        return n;
                                    for (t in i)
                                        "children" !== t && (e = "set" + A._capitalize(t),
                                        A._isFunction(n[e]) ? n[e](i[t]) : n._setAttr(t, i[t]))
                                }),
                                this
                            }
                            ,
                            dt.prototype.isListening = function() {
                                return this._getCache(it, this._isListening)
                            }
                            ,
                            dt.prototype._isListening = function(t) {
                                if (!this.listening())
                                    return !1;
                                var e = this.getParent();
                                return !e || e === t || this === t || e._isListening(t)
                            }
                            ,
                            dt.prototype.isVisible = function() {
                                return this._getCache(at, this._isVisible)
                            }
                            ,
                            dt.prototype._isVisible = function(t) {
                                if (!this.visible())
                                    return !1;
                                var e = this.getParent();
                                return !e || e === t || this === t || e._isVisible(t)
                            }
                            ,
                            dt.prototype.shouldDrawHit = function(t) {
                                if (t)
                                    return this._isVisible(t) && this._isListening(t);
                                var e = this.getLayer()
                                  , i = !1;
                                q._dragElements.forEach(function(t) {
                                    "dragging" === t.dragStatus && t.node.getLayer() === e && (i = !0)
                                });
                                var n = !G.hitOnDragEnabled && i;
                                return this.isListening() && this.isVisible() && !n
                            }
                            ,
                            dt.prototype.show = function() {
                                return this.visible(!0),
                                this
                            }
                            ,
                            dt.prototype.hide = function() {
                                return this.visible(!1),
                                this
                            }
                            ,
                            dt.prototype.getZIndex = function() {
                                return this.index || 0
                            }
                            ,
                            dt.prototype.getAbsoluteZIndex = function() {
                                var i, n, r, o, a = this.getDepth(), s = this, h = 0;
                                return "Stage" !== s.nodeType && function t(e) {
                                    for (i = [],
                                    n = e.length,
                                    r = 0; r < n; r++)
                                        o = e[r],
                                        h++,
                                        "Shape" !== o.nodeType && (i = i.concat(o.getChildren().toArray())),
                                        o._id === s._id && (r = n);
                                    0 < i.length && i[0].getDepth() <= a && t(i)
                                }(s.getStage().getChildren()),
                                h
                            }
                            ,
                            dt.prototype.getDepth = function() {
                                for (var t = 0, e = this.parent; e; )
                                    t++,
                                    e = e.parent;
                                return t
                            }
                            ,
                            dt.prototype._batchTransformChanges = function(t) {
                                this._batchingTransformChange = !0,
                                t(),
                                this._batchingTransformChange = !1,
                                this._needClearTransformCache && (this._clearCache(ot),
                                this._clearSelfAndDescendantCache($, !0)),
                                this._needClearTransformCache = !1
                            }
                            ,
                            dt.prototype.setPosition = function(t) {
                                var e = this;
                                return this._batchTransformChanges(function() {
                                    e.x(t.x),
                                    e.y(t.y)
                                }),
                                this
                            }
                            ,
                            dt.prototype.getPosition = function() {
                                return {
                                    x: this.x(),
                                    y: this.y()
                                }
                            }
                            ,
                            dt.prototype.getAbsolutePosition = function(t) {
                                for (var e = !1, i = this.parent; i; ) {
                                    if (i.isCached()) {
                                        e = !0;
                                        break
                                    }
                                    i = i.parent
                                }
                                e && !t && (t = !0);
                                var n = this.getAbsoluteTransform(t).getMatrix()
                                  , r = new p
                                  , o = this.offset();
                                return r.m = n.slice(),
                                r.translate(o.x, o.y),
                                r.getTranslation()
                            }
                            ,
                            dt.prototype.setAbsolutePosition = function(t) {
                                var e = this._clearTransform();
                                this.attrs.x = e.x,
                                this.attrs.y = e.y,
                                delete e.x,
                                delete e.y,
                                this._clearCache(ot);
                                var i = this._getAbsoluteTransform().copy();
                                return i.invert(),
                                i.translate(t.x, t.y),
                                t = {
                                    x: this.attrs.x + i.getTranslation().x,
                                    y: this.attrs.y + i.getTranslation().y
                                },
                                this._setTransform(e),
                                this.setPosition({
                                    x: t.x,
                                    y: t.y
                                }),
                                this._clearCache(ot),
                                this._clearSelfAndDescendantCache($),
                                this
                            }
                            ,
                            dt.prototype._setTransform = function(t) {
                                var e;
                                for (e in t)
                                    this.attrs[e] = t[e]
                            }
                            ,
                            dt.prototype._clearTransform = function() {
                                var t = {
                                    x: this.x(),
                                    y: this.y(),
                                    rotation: this.rotation(),
                                    scaleX: this.scaleX(),
                                    scaleY: this.scaleY(),
                                    offsetX: this.offsetX(),
                                    offsetY: this.offsetY(),
                                    skewX: this.skewX(),
                                    skewY: this.skewY()
                                };
                                return this.attrs.x = 0,
                                this.attrs.y = 0,
                                this.attrs.rotation = 0,
                                this.attrs.scaleX = 1,
                                this.attrs.scaleY = 1,
                                this.attrs.offsetX = 0,
                                this.attrs.offsetY = 0,
                                this.attrs.skewX = 0,
                                this.attrs.skewY = 0,
                                t
                            }
                            ,
                            dt.prototype.move = function(t) {
                                var e = t.x
                                  , i = t.y
                                  , n = this.x()
                                  , r = this.y();
                                return void 0 !== e && (n += e),
                                void 0 !== i && (r += i),
                                this.setPosition({
                                    x: n,
                                    y: r
                                }),
                                this
                            }
                            ,
                            dt.prototype._eachAncestorReverse = function(t, e) {
                                var i, n, r = [], o = this.getParent();
                                if (e && e._id === this._id)
                                    t(this);
                                else {
                                    for (r.unshift(this); o && (!e || o._id !== e._id); )
                                        r.unshift(o),
                                        o = o.parent;
                                    for (i = r.length,
                                    n = 0; n < i; n++)
                                        t(r[n])
                                }
                            }
                            ,
                            dt.prototype.rotate = function(t) {
                                return this.rotation(this.rotation() + t),
                                this
                            }
                            ,
                            dt.prototype.moveToTop = function() {
                                if (!this.parent)
                                    return A.warn("Node has no parent. moveToTop function is ignored."),
                                    !1;
                                var t = this.index;
                                return this.parent.children.splice(t, 1),
                                this.parent.children.push(this),
                                this.parent._setChildrenIndices(),
                                !0
                            }
                            ,
                            dt.prototype.moveUp = function() {
                                if (!this.parent)
                                    return A.warn("Node has no parent. moveUp function is ignored."),
                                    !1;
                                var t = this.index;
                                return t < this.parent.getChildren().length - 1 && (this.parent.children.splice(t, 1),
                                this.parent.children.splice(t + 1, 0, this),
                                this.parent._setChildrenIndices(),
                                !0)
                            }
                            ,
                            dt.prototype.moveDown = function() {
                                if (!this.parent)
                                    return A.warn("Node has no parent. moveDown function is ignored."),
                                    !1;
                                var t = this.index;
                                return 0 < t && (this.parent.children.splice(t, 1),
                                this.parent.children.splice(t - 1, 0, this),
                                this.parent._setChildrenIndices(),
                                !0)
                            }
                            ,
                            dt.prototype.moveToBottom = function() {
                                if (!this.parent)
                                    return A.warn("Node has no parent. moveToBottom function is ignored."),
                                    !1;
                                var t = this.index;
                                return 0 < t && (this.parent.children.splice(t, 1),
                                this.parent.children.unshift(this),
                                this.parent._setChildrenIndices(),
                                !0)
                            }
                            ,
                            dt.prototype.setZIndex = function(t) {
                                if (!this.parent)
                                    return A.warn("Node has no parent. zIndex parameter is ignored."),
                                    this;
                                (t < 0 || t >= this.parent.children.length) && A.warn("Unexpected value " + t + " for zIndex property. zIndex is just index of a node in children of its parent. Expected value is from 0 to " + (this.parent.children.length - 1) + ".");
                                var e = this.index;
                                return this.parent.children.splice(e, 1),
                                this.parent.children.splice(t, 0, this),
                                this.parent._setChildrenIndices(),
                                this
                            }
                            ,
                            dt.prototype.getAbsoluteOpacity = function() {
                                return this._getCache(Z, this._getAbsoluteOpacity)
                            }
                            ,
                            dt.prototype._getAbsoluteOpacity = function() {
                                var t = this.opacity()
                                  , e = this.getParent();
                                return e && !e._isUnderCache && (t *= e.getAbsoluteOpacity()),
                                t
                            }
                            ,
                            dt.prototype.moveTo = function(t) {
                                return this.getParent() !== t && (this._remove(),
                                t.add(this)),
                                this
                            }
                            ,
                            dt.prototype.toObject = function() {
                                var t, e, i, n = {}, r = this.getAttrs();
                                for (t in n.attrs = {},
                                r)
                                    e = r[t],
                                    A.isObject(e) && !A._isPlainObject(e) && !A._isArray(e) || (i = "function" == typeof this[t] && this[t],
                                    delete r[t],
                                    (i ? i.call(this) : null) !== (r[t] = e) && (n.attrs[t] = e));
                                return n.className = this.getClassName(),
                                A._prepareToStringify(n)
                            }
                            ,
                            dt.prototype.toJSON = function() {
                                return JSON.stringify(this.toObject())
                            }
                            ,
                            dt.prototype.getParent = function() {
                                return this.parent
                            }
                            ,
                            dt.prototype.findAncestors = function(t, e, i) {
                                var n = [];
                                e && this._isMatch(t) && n.push(this);
                                for (var r = this.parent; r; ) {
                                    if (r === i)
                                        return n;
                                    r._isMatch(t) && n.push(r),
                                    r = r.parent
                                }
                                return n
                            }
                            ,
                            dt.prototype.isAncestorOf = function(t) {
                                return !1
                            }
                            ,
                            dt.prototype.findAncestor = function(t, e, i) {
                                return this.findAncestors(t, e, i)[0]
                            }
                            ,
                            dt.prototype._isMatch = function(t) {
                                if (!t)
                                    return !1;
                                if ("function" == typeof t)
                                    return t(this);
                                for (var e, i = t.replace(/ /g, "").split(","), n = i.length, r = 0; r < n; r++)
                                    if (e = i[r],
                                    A.isValidSelector(e) || (A.warn('Selector "' + e + '" is invalid. Allowed selectors examples are "#foo", ".bar" or "Group".'),
                                    A.warn('If you have a custom shape with such className, please change it to start with upper letter like "Triangle".'),
                                    A.warn("Konva is awesome, right?")),
                                    "#" === e.charAt(0)) {
                                        if (this.id() === e.slice(1))
                                            return !0
                                    } else if ("." === e.charAt(0)) {
                                        if (this.hasName(e.slice(1)))
                                            return !0
                                    } else if (this.className === e || this.nodeType === e)
                                        return !0;
                                return !1
                            }
                            ,
                            dt.prototype.getLayer = function() {
                                var t = this.getParent();
                                return t ? t.getLayer() : null
                            }
                            ,
                            dt.prototype.getStage = function() {
                                return this._getCache("stage", this._getStage)
                            }
                            ,
                            dt.prototype._getStage = function() {
                                var t = this.getParent();
                                return t ? t.getStage() : void 0
                            }
                            ,
                            dt.prototype.fire = function(t, e, i) {
                                return void 0 === e && (e = {}),
                                e.target = e.target || this,
                                i ? this._fireAndBubble(t, e) : this._fire(t, e),
                                this
                            }
                            ,
                            dt.prototype.getAbsoluteTransform = function(t) {
                                return t ? this._getAbsoluteTransform(t) : this._getCache($, this._getAbsoluteTransform)
                            }
                            ,
                            dt.prototype._getAbsoluteTransform = function(t) {
                                var i;
                                if (t)
                                    return i = new p,
                                    this._eachAncestorReverse(function(t) {
                                        var e = t.transformsEnabled();
                                        "all" === e ? i.multiply(t.getTransform()) : "position" === e && i.translate(t.x() - t.offsetX(), t.y() - t.offsetY())
                                    }, t),
                                    i;
                                i = this._cache.get($) || new p,
                                this.parent ? this.parent.getAbsoluteTransform().copyInto(i) : i.reset();
                                var e, n, r, o, a = this.transformsEnabled();
                                return "all" === a ? i.multiply(this.getTransform()) : "position" === a && (e = this.attrs.x || 0,
                                n = this.attrs.y || 0,
                                r = this.attrs.offsetX || 0,
                                o = this.attrs.offsetY || 0,
                                i.translate(e - r, n - o)),
                                i.dirty = !1,
                                i
                            }
                            ,
                            dt.prototype.getAbsoluteScale = function(t) {
                                for (var e = this; e; )
                                    e._isUnderCache && (t = e),
                                    e = e.getParent();
                                var i = this.getAbsoluteTransform(t).decompose();
                                return {
                                    x: i.scaleX,
                                    y: i.scaleY
                                }
                            }
                            ,
                            dt.prototype.getAbsoluteRotation = function() {
                                return this.getAbsoluteTransform().decompose().rotation
                            }
                            ,
                            dt.prototype.getTransform = function() {
                                return this._getCache(ot, this._getTransform)
                            }
                            ,
                            dt.prototype._getTransform = function() {
                                var t, e, i = this._cache.get(ot) || new p;
                                i.reset();
                                var n = this.x()
                                  , r = this.y()
                                  , o = G.getAngle(this.rotation())
                                  , a = null !== (t = this.attrs.scaleX) && void 0 !== t ? t : 1
                                  , s = null !== (e = this.attrs.scaleY) && void 0 !== e ? e : 1
                                  , h = this.attrs.skewX || 0
                                  , l = this.attrs.skewY || 0
                                  , c = this.attrs.offsetX || 0
                                  , d = this.attrs.offsetY || 0;
                                return 0 === n && 0 === r || i.translate(n, r),
                                0 !== o && i.rotate(o),
                                0 === h && 0 === l || i.skew(h, l),
                                1 === a && 1 === s || i.scale(a, s),
                                0 === c && 0 === d || i.translate(-1 * c, -1 * d),
                                i.dirty = !1,
                                i
                            }
                            ,
                            dt.prototype.clone = function(t) {
                                var e, i, n, r, o, a = A.cloneObject(this.attrs);
                                for (e in t)
                                    a[e] = t[e];
                                var s = new this.constructor(a);
                                for (e in this.eventListeners)
                                    for (n = (i = this.eventListeners[e]).length,
                                    r = 0; r < n; r++)
                                        (o = i[r]).name.indexOf("konva") < 0 && (s.eventListeners[e] || (s.eventListeners[e] = []),
                                        s.eventListeners[e].push(o));
                                return s
                            }
                            ,
                            dt.prototype._toKonvaCanvas = function(t) {
                                t = t || {};
                                var e = this.getClientRect()
                                  , i = this.getStage()
                                  , n = void 0 !== t.x ? t.x : e.x
                                  , r = void 0 !== t.y ? t.y : e.y
                                  , o = t.pixelRatio || 1
                                  , a = new H({
                                    width: t.width || e.width || (i ? i.width() : 0),
                                    height: t.height || e.height || (i ? i.height() : 0),
                                    pixelRatio: o
                                })
                                  , s = a.getContext();
                                return s.save(),
                                (n || r) && s.translate(-1 * n, -1 * r),
                                this.drawScene(a),
                                s.restore(),
                                a
                            }
                            ,
                            dt.prototype.toCanvas = function(t) {
                                return this._toKonvaCanvas(t)._canvas
                            }
                            ,
                            dt.prototype.toDataURL = function(t) {
                                var e = (t = t || {}).mimeType || null
                                  , i = t.quality || null
                                  , n = this._toKonvaCanvas(t).toDataURL(e, i);
                                return t.callback && t.callback(n),
                                n
                            }
                            ,
                            dt.prototype.toImage = function(t) {
                                if (!t || !t.callback)
                                    throw "callback required for toImage method config argument";
                                var e = t.callback;
                                delete t.callback,
                                A._urlToImage(this.toDataURL(t), function(t) {
                                    e(t)
                                })
                            }
                            ,
                            dt.prototype.setSize = function(t) {
                                return this.width(t.width),
                                this.height(t.height),
                                this
                            }
                            ,
                            dt.prototype.getSize = function() {
                                return {
                                    width: this.width(),
                                    height: this.height()
                                }
                            }
                            ,
                            dt.prototype.getClassName = function() {
                                return this.className || this.nodeType
                            }
                            ,
                            dt.prototype.getType = function() {
                                return this.nodeType
                            }
                            ,
                            dt.prototype.getDragDistance = function() {
                                return void 0 !== this.attrs.dragDistance ? this.attrs.dragDistance : this.parent ? this.parent.getDragDistance() : G.dragDistance
                            }
                            ,
                            dt.prototype._off = function(t, e, i) {
                                for (var n, r, o = this.eventListeners[t], a = 0; a < o.length; a++)
                                    if (n = o[a].name,
                                    r = o[a].handler,
                                    !("konva" === n && "konva" !== e || e && n !== e || i && i !== r)) {
                                        if (o.splice(a, 1),
                                        0 === o.length) {
                                            delete this.eventListeners[t];
                                            break
                                        }
                                        a--
                                    }
                            }
                            ,
                            dt.prototype._fireChangeEvent = function(t, e, i) {
                                this._fire(t + "Change", {
                                    oldVal: e,
                                    newVal: i
                                })
                            }
                            ,
                            dt.prototype.setId = function(t) {
                                var e, i, n = this.id();
                                return K(n, this),
                                e = this,
                                (i = t) && (Q[i] = e),
                                this._setAttr("id", t),
                                this
                            }
                            ,
                            dt.prototype.setName = function(t) {
                                for (var e, i, n, r = (this.name() || "").split(/\s/g), o = (t || "").split(/\s/g), a = 0; a < r.length; a++)
                                    e = r[a],
                                    -1 === o.indexOf(e) && e && V(e, this._id);
                                for (a = 0; a < o.length; a++)
                                    e = o[a],
                                    -1 === r.indexOf(e) && e && (i = this,
                                    (n = e) && (J[n] || (J[n] = []),
                                    J[n].push(i)));
                                return this._setAttr("name", t),
                                this
                            }
                            ,
                            dt.prototype.addName = function(t) {
                                var e, i;
                                return this.hasName(t) || (i = (e = this.name()) ? e + " " + t : t,
                                this.setName(i)),
                                this
                            }
                            ,
                            dt.prototype.hasName = function(t) {
                                if (!t)
                                    return !1;
                                var e = this.name();
                                return !!e && -1 !== (e || "").split(/\s/g).indexOf(t)
                            }
                            ,
                            dt.prototype.removeName = function(t) {
                                var e = (this.name() || "").split(/\s/g)
                                  , i = e.indexOf(t);
                                return -1 !== i && (e.splice(i, 1),
                                this.setName(e.join(" "))),
                                this
                            }
                            ,
                            dt.prototype.setAttr = function(t, e) {
                                var i = this["set" + A._capitalize(t)];
                                return A._isFunction(i) ? i.call(this, e) : this._setAttr(t, e),
                                this
                            }
                            ,
                            dt.prototype._setAttr = function(t, e) {
                                var i = this.attrs[t];
                                i === e && !A.isObject(e) || (null == e ? delete this.attrs[t] : this.attrs[t] = e,
                                this._fireChangeEvent(t, i, e))
                            }
                            ,
                            dt.prototype._setComponentAttr = function(t, e, i) {
                                var n;
                                void 0 !== i && ((n = this.attrs[t]) || (this.attrs[t] = this.getAttr(t)),
                                this.attrs[t][e] = i,
                                this._fireChangeEvent(t, n, i))
                            }
                            ,
                            dt.prototype._fireAndBubble = function(t, e, i) {
                                var n;
                                e && "Shape" === this.nodeType && (e.target = this),
                                (t === nt || t === rt) && (i && (this === i || this.isAncestorOf && this.isAncestorOf(i)) || "Stage" === this.nodeType && !i) || (this._fire(t, e),
                                n = (t === nt || t === rt) && i && i.isAncestorOf && i.isAncestorOf(this) && !i.isAncestorOf(this.parent),
                                (e && !e.cancelBubble || !e) && this.parent && this.parent.isListening() && !n && (i && i.parent ? this._fireAndBubble.call(this.parent, t, e, i) : this._fireAndBubble.call(this.parent, t, e)))
                            }
                            ,
                            dt.prototype._fire = function(t, e) {
                                var i, n = this.eventListeners[t];
                                if (n)
                                    for ((e = e || {}).currentTarget = this,
                                    e.type = t,
                                    i = 0; i < n.length; i++)
                                        n[i].handler.call(this, e)
                            }
                            ,
                            dt.prototype.draw = function() {
                                return this.drawScene(),
                                this.drawHit(),
                                this
                            }
                            ,
                            dt.prototype._createDragElement = function(t) {
                                var e = t ? t.pointerId : void 0
                                  , i = this.getStage()
                                  , n = this.getAbsolutePosition()
                                  , r = i._getPointerById(e) || i._changedPointerPositions[0] || n;
                                q._dragElements.set(this._id, {
                                    node: this,
                                    startPointerPos: r,
                                    offset: {
                                        x: r.x - n.x,
                                        y: r.y - n.y
                                    },
                                    dragStatus: "ready",
                                    pointerId: e
                                })
                            }
                            ,
                            dt.prototype.startDrag = function(t) {
                                q._dragElements.has(this._id) || this._createDragElement(t),
                                q._dragElements.get(this._id).dragStatus = "dragging",
                                this.fire("dragstart", {
                                    type: "dragstart",
                                    target: this,
                                    evt: t && t.evt
                                }, !0)
                            }
                            ,
                            dt.prototype._setDragPosition = function(t, e) {
                                var i, n, r, o = this.getStage()._getPointerById(e.pointerId);
                                o && (i = {
                                    x: o.x - e.offset.x,
                                    y: o.y - e.offset.y
                                },
                                void 0 !== (n = this.dragBoundFunc()) && ((r = n.call(this, i, t)) ? i = r : A.warn("dragBoundFunc did not return any value. That is unexpected behavior. You must return new absolute position from dragBoundFunc.")),
                                this._lastPos && this._lastPos.x === i.x && this._lastPos.y === i.y || (this.setAbsolutePosition(i),
                                this.getLayer() ? this.getLayer().batchDraw() : this.getStage() && this.getStage().batchDraw()),
                                this._lastPos = i)
                            }
                            ,
                            dt.prototype.stopDrag = function(t) {
                                var e = q._dragElements.get(this._id);
                                e && (e.dragStatus = "stopped"),
                                q._endDragBefore(t),
                                q._endDragAfter(t)
                            }
                            ,
                            dt.prototype.setDraggable = function(t) {
                                this._setAttr("draggable", t),
                                this._dragChange()
                            }
                            ,
                            dt.prototype.isDragging = function() {
                                var t = q._dragElements.get(this._id);
                                return !!t && "dragging" === t.dragStatus
                            }
                            ,
                            dt.prototype._listenDrag = function() {
                                this._dragCleanup(),
                                this.on("mousedown.konva touchstart.konva", function(t) {
                                    var e, i = this;
                                    void 0 !== t.evt.button && !(0 <= G.dragButtons.indexOf(t.evt.button)) || this.isDragging() || (e = !1,
                                    q._dragElements.forEach(function(t) {
                                        i.isAncestorOf(t.node) && (e = !0)
                                    }),
                                    e || this._createDragElement(t))
                                })
                            }
                            ,
                            dt.prototype._dragChange = function() {
                                if (this.attrs.draggable)
                                    this._listenDrag();
                                else {
                                    if (this._dragCleanup(),
                                    !this.getStage())
                                        return;
                                    var t = q._dragElements.get(this._id)
                                      , e = t && "dragging" === t.dragStatus
                                      , i = t && "ready" === t.dragStatus;
                                    e ? this.stopDrag() : i && q._dragElements.delete(this._id)
                                }
                            }
                            ,
                            dt.prototype._dragCleanup = function() {
                                this.off("mousedown.konva"),
                                this.off("touchstart.konva")
                            }
                            ,
                            dt.create = function(t, e) {
                                return A._isString(t) && (t = JSON.parse(t)),
                                this._createNode(t, e)
                            }
                            ,
                            dt._createNode = function(t, e) {
                                var i, n, r = dt.prototype.getClassName.call(t), o = t.children;
                                e && (t.attrs.container = e),
                                s[r] || (A.warn('Can not find a node with class name "' + r + '". Fallback to "Shape".'),
                                r = "Shape");
                                var a = new s[r](t.attrs);
                                if (o)
                                    for (i = o.length,
                                    n = 0; n < i; n++)
                                        a.add(dt._createNode(o[n]));
                                return a
                            }
                            ,
                            dt);
                            function dt(t) {
                                var e = this;
                                this._id = lt++,
                                this.eventListeners = {},
                                this.attrs = {},
                                this.index = 0,
                                this.parent = null,
                                this._cache = new Map,
                                this._attachedDepsListeners = new Map,
                                this._lastPos = null,
                                this._batchingTransformChange = !1,
                                this._needClearTransformCache = !1,
                                this._filterUpToDate = !1,
                                this._isUnderCache = !1,
                                this.children = ht,
                                this._dragEventId = null,
                                this.setAttrs(t),
                                this.on(st, function() {
                                    e._batchingTransformChange ? e._needClearTransformCache = !0 : (e._clearCache(ot),
                                    e._clearSelfAndDescendantCache($))
                                }),
                                this.on("visibleChange.konva", function() {
                                    e._clearSelfAndDescendantCache(at)
                                }),
                                this.on("listeningChange.konva", function() {
                                    e._clearSelfAndDescendantCache(it)
                                }),
                                this.on("opacityChange.konva", function() {
                                    e._clearSelfAndDescendantCache(Z)
                                })
                            }
                            ct.prototype.nodeType = "Node",
                            ct.prototype._attrsAffectingSize = [];
                            var pt = w.addGetterSetter;
                            pt(ct, "zIndex"),
                            pt(ct, "absolutePosition"),
                            pt(ct, "position"),
                            pt(ct, "x", 0, y()),
                            pt(ct, "y", 0, y()),
                            pt(ct, "globalCompositeOperation", "source-over", _()),
                            pt(ct, "opacity", 1, y()),
                            pt(ct, "name", "", _()),
                            pt(ct, "id", "", _()),
                            pt(ct, "rotation", 0, y()),
                            w.addComponentsGetterSetter(ct, "scale", ["x", "y"]),
                            pt(ct, "scaleX", 1, y()),
                            pt(ct, "scaleY", 1, y()),
                            w.addComponentsGetterSetter(ct, "skew", ["x", "y"]),
                            pt(ct, "skewX", 0, y()),
                            pt(ct, "skewY", 0, y()),
                            w.addComponentsGetterSetter(ct, "offset", ["x", "y"]),
                            pt(ct, "offsetX", 0, y()),
                            pt(ct, "offsetY", 0, y()),
                            pt(ct, "dragDistance", null, y()),
                            pt(ct, "width", 0, y()),
                            pt(ct, "height", 0, y()),
                            pt(ct, "listening", !0, b()),
                            pt(ct, "preventDefault", !0, b()),
                            pt(ct, "filters", null, function(t) {
                                return this._filterUpToDate = !1,
                                t
                            }),
                            pt(ct, "visible", !0, b()),
                            pt(ct, "transformsEnabled", "all", _()),
                            pt(ct, "size"),
                            pt(ct, "dragBoundFunc"),
                            pt(ct, "draggable", !1, b()),
                            w.backCompat(ct, {
                                rotateDeg: "rotate",
                                setRotationDeg: "setRotation",
                                getRotationDeg: "getRotation"
                            }),
                            o.mapMethods(ct);
                            var ut, ft = (P(gt, ut = ct),
                            gt.prototype.getChildren = function(e) {
                                if (!e)
                                    return this.children;
                                var i = new o;
                                return this.children.each(function(t) {
                                    e(t) && i.push(t)
                                }),
                                i
                            }
                            ,
                            gt.prototype.hasChildren = function() {
                                return 0 < this.getChildren().length
                            }
                            ,
                            gt.prototype.removeChildren = function() {
                                for (var t, e = 0; e < this.children.length; e++)
                                    (t = this.children[e]).parent = null,
                                    t.index = 0,
                                    t.remove();
                                return this.children = new o,
                                this
                            }
                            ,
                            gt.prototype.destroyChildren = function() {
                                for (var t, e = 0; e < this.children.length; e++)
                                    (t = this.children[e]).parent = null,
                                    t.index = 0,
                                    t.destroy();
                                return this.children = new o,
                                this
                            }
                            ,
                            gt.prototype.add = function() {
                                for (var t = [], e = 0; e < arguments.length; e++)
                                    t[e] = arguments[e];
                                if (1 < arguments.length) {
                                    for (var i = 0; i < arguments.length; i++)
                                        this.add(arguments[i]);
                                    return this
                                }
                                var n = t[0];
                                if (n.getParent())
                                    return n.moveTo(this),
                                    this;
                                var r = this.children;
                                return this._validateAdd(n),
                                n._clearCaches(),
                                n.index = r.length,
                                n.parent = this,
                                r.push(n),
                                this._fire("add", {
                                    child: n
                                }),
                                this
                            }
                            ,
                            gt.prototype.destroy = function() {
                                return this.hasChildren() && this.destroyChildren(),
                                ut.prototype.destroy.call(this),
                                this
                            }
                            ,
                            gt.prototype.find = function(t) {
                                return this._generalFind(t, !1)
                            }
                            ,
                            gt.prototype.get = function(t) {
                                return A.warn("collection.get() method is deprecated. Please use collection.find() instead."),
                                this.find(t)
                            }
                            ,
                            gt.prototype.findOne = function(t) {
                                var e = this._generalFind(t, !0);
                                return 0 < e.length ? e[0] : void 0
                            }
                            ,
                            gt.prototype._generalFind = function(i, n) {
                                var r = [];
                                return this._descendants(function(t) {
                                    var e = t._isMatch(i);
                                    return e && r.push(t),
                                    !(!e || !n)
                                }),
                                o.toCollection(r)
                            }
                            ,
                            gt.prototype._descendants = function(t) {
                                for (var e = 0; e < this.children.length; e++) {
                                    var i = this.children[e];
                                    if (t(i))
                                        return !0;
                                    if (i.hasChildren() && i._descendants(t))
                                        return !0
                                }
                                return !1
                            }
                            ,
                            gt.prototype.toObject = function() {
                                var t = ct.prototype.toObject.call(this);
                                t.children = [];
                                for (var e = this.getChildren(), i = e.length, n = 0; n < i; n++) {
                                    var r = e[n];
                                    t.children.push(r.toObject())
                                }
                                return t
                            }
                            ,
                            gt.prototype.isAncestorOf = function(t) {
                                for (var e = t.getParent(); e; ) {
                                    if (e._id === this._id)
                                        return !0;
                                    e = e.getParent()
                                }
                                return !1
                            }
                            ,
                            gt.prototype.clone = function(t) {
                                var e = ct.prototype.clone.call(this, t);
                                return this.getChildren().each(function(t) {
                                    e.add(t.clone())
                                }),
                                e
                            }
                            ,
                            gt.prototype.getAllIntersections = function(e) {
                                var i = [];
                                return this.find("Shape").each(function(t) {
                                    t.isVisible() && t.intersects(e) && i.push(t)
                                }),
                                i
                            }
                            ,
                            gt.prototype._setChildrenIndices = function() {
                                this.children.each(function(t, e) {
                                    t.index = e
                                })
                            }
                            ,
                            gt.prototype.drawScene = function(t, e) {
                                var i, n = this.getLayer(), r = t || n && n.getCanvas(), o = r && r.getContext(), a = this._getCanvasCache(), s = a && a.scene, h = r && r.isCache;
                                return (this.isVisible() || h) && (s ? (o.save(),
                                i = this.getAbsoluteTransform(e).getMatrix(),
                                o.transform(i[0], i[1], i[2], i[3], i[4], i[5]),
                                this._drawCachedSceneCanvas(o),
                                o.restore()) : this._drawChildren("drawScene", r, e)),
                                this
                            }
                            ,
                            gt.prototype.drawHit = function(t, e) {
                                if (!this.shouldDrawHit(e))
                                    return this;
                                var i, n = this.getLayer(), r = t || n && n.hitCanvas, o = r && r.getContext(), a = this._getCanvasCache();
                                return a && a.hit ? (o.save(),
                                i = this.getAbsoluteTransform(e).getMatrix(),
                                o.transform(i[0], i[1], i[2], i[3], i[4], i[5]),
                                this._drawCachedHitCanvas(o),
                                o.restore()) : this._drawChildren("drawHit", r, e),
                                this
                            }
                            ,
                            gt.prototype._drawChildren = function(e, i, n) {
                                var t, r, o, a, s = i && i.getContext(), h = this.clipWidth(), l = this.clipHeight(), c = this.clipFunc(), d = h && l || c, p = n === this;
                                d && (s.save(),
                                r = (t = this.getAbsoluteTransform(n)).getMatrix(),
                                s.transform(r[0], r[1], r[2], r[3], r[4], r[5]),
                                s.beginPath(),
                                c ? c.call(this, s, this) : (o = this.clipX(),
                                a = this.clipY(),
                                s.rect(o, a, h, l)),
                                s.clip(),
                                r = t.copy().invert().getMatrix(),
                                s.transform(r[0], r[1], r[2], r[3], r[4], r[5]));
                                var u = !p && "source-over" !== this.globalCompositeOperation() && "drawScene" === e;
                                u && (s.save(),
                                s._applyGlobalCompositeOperation(this)),
                                this.children.each(function(t) {
                                    t[e](i, n)
                                }),
                                u && s.restore(),
                                d && s.restore()
                            }
                            ,
                            gt.prototype.getClientRect = function(i) {
                                var n, r, o, a, t = (i = i || {}).skipTransform, e = i.relativeTo, s = {
                                    x: 1 / 0,
                                    y: 1 / 0,
                                    width: 0,
                                    height: 0
                                }, h = this;
                                this.children.each(function(t) {
                                    var e;
                                    t.visible() && (0 === (e = t.getClientRect({
                                        relativeTo: h,
                                        skipShadow: i.skipShadow,
                                        skipStroke: i.skipStroke
                                    })).width && 0 === e.height || (a = void 0 === n ? (n = e.x,
                                    r = e.y,
                                    o = e.x + e.width,
                                    e.y + e.height) : (n = Math.min(n, e.x),
                                    r = Math.min(r, e.y),
                                    o = Math.max(o, e.x + e.width),
                                    Math.max(a, e.y + e.height))))
                                });
                                for (var l = this.find("Shape"), c = !1, d = 0; d < l.length; d++)
                                    if (l[d]._isVisible(this)) {
                                        c = !0;
                                        break
                                    }
                                return s = c && void 0 !== n ? {
                                    x: n,
                                    y: r,
                                    width: o - n,
                                    height: a - r
                                } : {
                                    x: 0,
                                    y: 0,
                                    width: 0,
                                    height: 0
                                },
                                t ? s : this._transformedRect(s, e)
                            }
                            ,
                            gt);
                            function gt() {
                                var t = null !== ut && ut.apply(this, arguments) || this;
                                return t.children = new o,
                                t
                            }
                            w.addComponentsGetterSetter(ft, "clip", ["x", "y", "width", "height"]),
                            w.addGetterSetter(ft, "clipX", void 0, y()),
                            w.addGetterSetter(ft, "clipY", void 0, y()),
                            w.addGetterSetter(ft, "clipWidth", void 0, y()),
                            w.addGetterSetter(ft, "clipHeight", void 0, y()),
                            w.addGetterSetter(ft, "clipFunc"),
                            o.mapMethods(ft);
                            var vt = new Map
                              , yt = void 0 !== G._global.PointerEvent;
                            function mt(t) {
                                return vt.get(t)
                            }
                            function _t(t) {
                                return {
                                    evt: t,
                                    pointerId: t.pointerId
                                }
                            }
                            function bt(t, e) {
                                return vt.get(t) === e
                            }
                            function xt(t, e) {
                                St(t),
                                e.getStage() && (vt.set(t, e),
                                yt && e._fire("gotpointercapture", _t(new PointerEvent("gotpointercapture"))))
                            }
                            function St(t) {
                                var e, i = vt.get(t);
                                i && ((e = i.getStage()) && e.content,
                                vt.delete(t),
                                yt && i._fire("lostpointercapture", _t(new PointerEvent("lostpointercapture"))))
                            }
                            var wt = "mouseout"
                              , Ct = "mouseleave"
                              , Pt = "mouseover"
                              , kt = "mouseenter"
                              , Tt = "mousemove"
                              , At = "mousedown"
                              , Mt = "mouseup"
                              , Gt = "pointermove"
                              , Rt = "pointerdown"
                              , Et = "pointerup"
                              , It = "contextmenu"
                              , Lt = "dblclick"
                              , Dt = "touchstart"
                              , Ot = "touchend"
                              , Ft = "touchmove"
                              , Bt = "wheel"
                              , Nt = "_"
                              , zt = [kt, At, Tt, Mt, wt, Dt, Ft, Ot, Pt, Bt, It, Rt, Gt, Et, "pointercancel", "lostpointercapture"]
                              , Wt = zt.length;
                            function Ht(e, i) {
                                e.content.addEventListener(i, function(t) {
                                    e[Nt + i](t)
                                }, !1)
                            }
                            var Yt = [];
                            function Xt(t) {
                                return void 0 === t && (t = {}),
                                (t.clipFunc || t.clipWidth || t.clipHeight) && A.warn("Stage does not support clipping. Please use clip for Layers or Groups."),
                                t
                            }
                            var jt, Ut = (P(qt, jt = ft),
                            qt.prototype._validateAdd = function(t) {
                                var e = "Layer" === t.getType()
                                  , i = "FastLayer" === t.getType();
                                e || i || A.throw("You may only add layers to the stage.")
                            }
                            ,
                            qt.prototype._checkVisibility = function() {
                                var t;
                                this.content && (t = this.visible() ? "" : "none",
                                this.content.style.display = t)
                            }
                            ,
                            qt.prototype.setContainer = function(t) {
                                var e, i;
                                if ("string" == typeof t && !(t = "." === t.charAt(0) ? (e = t.slice(1),
                                document.getElementsByClassName(e)[0]) : (i = "#" !== t.charAt(0) ? t : t.slice(1),
                                document.getElementById(i))))
                                    throw "Can not find container in document with id " + i;
                                return this._setAttr("container", t),
                                this.content && (this.content.parentElement && this.content.parentElement.removeChild(this.content),
                                t.appendChild(this.content)),
                                this
                            }
                            ,
                            qt.prototype.shouldDrawHit = function() {
                                return !0
                            }
                            ,
                            qt.prototype.clear = function() {
                                for (var t = this.children, e = t.length, i = 0; i < e; i++)
                                    t[i].clear();
                                return this
                            }
                            ,
                            qt.prototype.clone = function(t) {
                                return (t = t || {}).container = document.createElement("div"),
                                ft.prototype.clone.call(this, t)
                            }
                            ,
                            qt.prototype.destroy = function() {
                                jt.prototype.destroy.call(this);
                                var t = this.content;
                                t && A._isInDocument(t) && this.container().removeChild(t);
                                var e = Yt.indexOf(this);
                                return -1 < e && Yt.splice(e, 1),
                                this
                            }
                            ,
                            qt.prototype.getPointerPosition = function() {
                                var t = this._pointerPositions[0] || this._changedPointerPositions[0];
                                return t ? {
                                    x: t.x,
                                    y: t.y
                                } : (A.warn("Pointer position is missing and not registered by the stage. Looks like it is outside of the stage container. You can set it manually from event: stage.setPointersPositions(event);"),
                                null)
                            }
                            ,
                            qt.prototype._getPointerById = function(e) {
                                return this._pointerPositions.find(function(t) {
                                    return t.id === e
                                })
                            }
                            ,
                            qt.prototype.getPointersPositions = function() {
                                return this._pointerPositions
                            }
                            ,
                            qt.prototype.getStage = function() {
                                return this
                            }
                            ,
                            qt.prototype.getContent = function() {
                                return this.content
                            }
                            ,
                            qt.prototype._toKonvaCanvas = function(i) {
                                var n = (i = i || {}).x || 0
                                  , r = i.y || 0
                                  , t = new H({
                                    width: i.width || this.width(),
                                    height: i.height || this.height(),
                                    pixelRatio: i.pixelRatio || 1
                                })
                                  , o = t.getContext()._context
                                  , e = this.children;
                                return (n || r) && o.translate(-1 * n, -1 * r),
                                e.each(function(t) {
                                    var e;
                                    t.isVisible() && (e = t._toKonvaCanvas(i),
                                    o.drawImage(e._canvas, n, r, e.getWidth() / e.getPixelRatio(), e.getHeight() / e.getPixelRatio()))
                                }),
                                t
                            }
                            ,
                            qt.prototype.getIntersection = function(t, e) {
                                if (!t)
                                    return null;
                                for (var i, n = this.children, r = n.length - 1; 0 <= r; r--)
                                    if (i = n[r].getIntersection(t, e))
                                        return i;
                                return null
                            }
                            ,
                            qt.prototype._resizeDOM = function() {
                                var e = this.width()
                                  , i = this.height();
                                this.content && (this.content.style.width = e + "px",
                                this.content.style.height = i + "px"),
                                this.bufferCanvas.setSize(e, i),
                                this.bufferHitCanvas.setSize(e, i),
                                this.children.each(function(t) {
                                    t.setSize({
                                        width: e,
                                        height: i
                                    }),
                                    t.draw()
                                })
                            }
                            ,
                            qt.prototype.add = function(t) {
                                if (1 < arguments.length) {
                                    for (var e = 0; e < arguments.length; e++)
                                        this.add(arguments[e]);
                                    return this
                                }
                                jt.prototype.add.call(this, t);
                                var i = this.children.length;
                                return 5 < i && A.warn("The stage has " + i + " layers. Recommended maximum number of layers is 3-5. Adding more layers into the stage may drop the performance. Rethink your tree structure, you can use Konva.Group."),
                                t.setSize({
                                    width: this.width(),
                                    height: this.height()
                                }),
                                t.draw(),
                                G.isBrowser && this.content.appendChild(t.canvas._canvas),
                                this
                            }
                            ,
                            qt.prototype.getParent = function() {
                                return null
                            }
                            ,
                            qt.prototype.getLayer = function() {
                                return null
                            }
                            ,
                            qt.prototype.hasPointerCapture = function(t) {
                                return bt(t, this)
                            }
                            ,
                            qt.prototype.setPointerCapture = function(t) {
                                xt(t, this)
                            }
                            ,
                            qt.prototype.releaseCapture = function(t) {
                                St(t)
                            }
                            ,
                            qt.prototype.getLayers = function() {
                                return this.getChildren()
                            }
                            ,
                            qt.prototype._bindContentEvents = function() {
                                if (G.isBrowser)
                                    for (var t = 0; t < Wt; t++)
                                        Ht(this, zt[t])
                            }
                            ,
                            qt.prototype._mouseenter = function(t) {
                                this.setPointersPositions(t),
                                this._fire(kt, {
                                    evt: t,
                                    target: this,
                                    currentTarget: this
                                })
                            }
                            ,
                            qt.prototype._mouseover = function(t) {
                                this.setPointersPositions(t),
                                this._fire("contentMouseover", {
                                    evt: t
                                }),
                                this._fire(Pt, {
                                    evt: t,
                                    target: this,
                                    currentTarget: this
                                })
                            }
                            ,
                            qt.prototype._mouseout = function(t) {
                                var e;
                                this.setPointersPositions(t);
                                var i = null !== (e = this.targetShape) && void 0 !== e && e.getStage() ? this.targetShape : null
                                  , n = !q.isDragging || G.hitOnDragEnabled;
                                i && n ? (i._fireAndBubble(wt, {
                                    evt: t
                                }),
                                i._fireAndBubble(Ct, {
                                    evt: t
                                }),
                                this._fire(Ct, {
                                    evt: t,
                                    target: this,
                                    currentTarget: this
                                }),
                                this.targetShape = null) : n && (this._fire(Ct, {
                                    evt: t,
                                    target: this,
                                    currentTarget: this
                                }),
                                this._fire(wt, {
                                    evt: t,
                                    target: this,
                                    currentTarget: this
                                })),
                                this.pointerPos = void 0,
                                this._pointerPositions = [],
                                this._fire("contentMouseout", {
                                    evt: t
                                })
                            }
                            ,
                            qt.prototype._mousemove = function(t) {
                                var e;
                                if (G.UA.ieMobile)
                                    return this._touchmove(t);
                                this.setPointersPositions(t);
                                var i, n = A._getFirstPointerId(t), r = null !== (e = this.targetShape) && void 0 !== e && e.getStage() ? this.targetShape : null, o = !q.isDragging || G.hitOnDragEnabled;
                                o && ((i = this.getIntersection(this.getPointerPosition())) && i.isListening() ? o && r !== i ? (r && (r._fireAndBubble(wt, {
                                    evt: t,
                                    pointerId: n
                                }, i),
                                r._fireAndBubble(Ct, {
                                    evt: t,
                                    pointerId: n
                                }, i)),
                                i._fireAndBubble(Pt, {
                                    evt: t,
                                    pointerId: n
                                }, r),
                                i._fireAndBubble(kt, {
                                    evt: t,
                                    pointerId: n
                                }, r),
                                i._fireAndBubble(Tt, {
                                    evt: t,
                                    pointerId: n
                                }),
                                this.targetShape = i) : i._fireAndBubble(Tt, {
                                    evt: t,
                                    pointerId: n
                                }) : (r && o && (r._fireAndBubble(wt, {
                                    evt: t,
                                    pointerId: n
                                }),
                                r._fireAndBubble(Ct, {
                                    evt: t,
                                    pointerId: n
                                }),
                                this._fire(Pt, {
                                    evt: t,
                                    target: this,
                                    currentTarget: this,
                                    pointerId: n
                                }),
                                this.targetShape = null),
                                this._fire(Tt, {
                                    evt: t,
                                    target: this,
                                    currentTarget: this,
                                    pointerId: n
                                })),
                                this._fire("contentMousemove", {
                                    evt: t
                                })),
                                t.cancelable && t.preventDefault()
                            }
                            ,
                            qt.prototype._mousedown = function(t) {
                                if (G.UA.ieMobile)
                                    return this._touchstart(t);
                                this.setPointersPositions(t);
                                var e = A._getFirstPointerId(t)
                                  , i = this.getIntersection(this.getPointerPosition());
                                q.justDragged = !1,
                                G.listenClickTap = !0,
                                i && i.isListening() ? (this.clickStartShape = i)._fireAndBubble(At, {
                                    evt: t,
                                    pointerId: e
                                }) : this._fire(At, {
                                    evt: t,
                                    target: this,
                                    currentTarget: this,
                                    pointerId: e
                                }),
                                this._fire("contentMousedown", {
                                    evt: t
                                })
                            }
                            ,
                            qt.prototype._mouseup = function(t) {
                                if (G.UA.ieMobile)
                                    return this._touchend(t);
                                this.setPointersPositions(t);
                                var e = A._getFirstPointerId(t)
                                  , i = this.getIntersection(this.getPointerPosition())
                                  , n = this.clickStartShape
                                  , r = this.clickEndShape
                                  , o = !1;
                                G.inDblClickWindow ? (o = !0,
                                clearTimeout(this.dblTimeout)) : q.justDragged || (G.inDblClickWindow = !0,
                                clearTimeout(this.dblTimeout)),
                                this.dblTimeout = setTimeout(function() {
                                    G.inDblClickWindow = !1
                                }, G.dblClickWindow),
                                i && i.isListening() ? ((this.clickEndShape = i)._fireAndBubble(Mt, {
                                    evt: t,
                                    pointerId: e
                                }),
                                G.listenClickTap && n && n._id === i._id && (i._fireAndBubble("click", {
                                    evt: t,
                                    pointerId: e
                                }),
                                o && r && r === i && i._fireAndBubble(Lt, {
                                    evt: t,
                                    pointerId: e
                                }))) : (this.clickEndShape = null,
                                this._fire(Mt, {
                                    evt: t,
                                    target: this,
                                    currentTarget: this,
                                    pointerId: e
                                }),
                                G.listenClickTap && this._fire("click", {
                                    evt: t,
                                    target: this,
                                    currentTarget: this,
                                    pointerId: e
                                }),
                                o && this._fire(Lt, {
                                    evt: t,
                                    target: this,
                                    currentTarget: this,
                                    pointerId: e
                                })),
                                this._fire("contentMouseup", {
                                    evt: t
                                }),
                                G.listenClickTap && (this._fire("contentClick", {
                                    evt: t
                                }),
                                o && this._fire("contentDblclick", {
                                    evt: t
                                })),
                                G.listenClickTap = !1,
                                t.cancelable && t.preventDefault()
                            }
                            ,
                            qt.prototype._contextmenu = function(t) {
                                this.setPointersPositions(t);
                                var e = this.getIntersection(this.getPointerPosition());
                                e && e.isListening() ? e._fireAndBubble(It, {
                                    evt: t
                                }) : this._fire(It, {
                                    evt: t,
                                    target: this,
                                    currentTarget: this
                                }),
                                this._fire("contentContextmenu", {
                                    evt: t
                                })
                            }
                            ,
                            qt.prototype._touchstart = function(i) {
                                var n = this;
                                this.setPointersPositions(i);
                                var r = !1;
                                this._changedPointerPositions.forEach(function(t) {
                                    var e = n.getIntersection(t);
                                    G.listenClickTap = !0,
                                    q.justDragged = !1,
                                    e && e.isListening() && (G.captureTouchEventsEnabled && e.setPointerCapture(t.id),
                                    (n.tapStartShape = e)._fireAndBubble(Dt, {
                                        evt: i,
                                        pointerId: t.id
                                    }, n),
                                    r = !0,
                                    e.isListening() && e.preventDefault() && i.cancelable && i.preventDefault())
                                }),
                                r || this._fire(Dt, {
                                    evt: i,
                                    target: this,
                                    currentTarget: this,
                                    pointerId: this._changedPointerPositions[0].id
                                }),
                                this._fire("contentTouchstart", {
                                    evt: i
                                })
                            }
                            ,
                            qt.prototype._touchmove = function(i) {
                                var n, r, o = this;
                                this.setPointersPositions(i),
                                q.isDragging && !G.hitOnDragEnabled || (n = !1,
                                r = {},
                                this._changedPointerPositions.forEach(function(t) {
                                    var e = mt(t.id) || o.getIntersection(t);
                                    e && e.isListening() && (r[e._id] || (r[e._id] = !0,
                                    e._fireAndBubble(Ft, {
                                        evt: i,
                                        pointerId: t.id
                                    }),
                                    n = !0,
                                    e.isListening() && e.preventDefault() && i.cancelable && i.preventDefault()))
                                }),
                                n || this._fire(Ft, {
                                    evt: i,
                                    target: this,
                                    currentTarget: this,
                                    pointerId: this._changedPointerPositions[0].id
                                }),
                                this._fire("contentTouchmove", {
                                    evt: i
                                })),
                                q.isDragging && q.node.preventDefault() && i.cancelable && i.preventDefault()
                            }
                            ,
                            qt.prototype._touchend = function(i) {
                                var n = this;
                                this.setPointersPositions(i);
                                var r = this.tapEndShape
                                  , o = !1;
                                G.inDblClickWindow ? (o = !0,
                                clearTimeout(this.dblTimeout)) : q.justDragged || (G.inDblClickWindow = !0,
                                clearTimeout(this.dblTimeout)),
                                this.dblTimeout = setTimeout(function() {
                                    G.inDblClickWindow = !1
                                }, G.dblClickWindow);
                                var a = !1
                                  , s = {}
                                  , h = !1
                                  , l = !1;
                                this._changedPointerPositions.forEach(function(t) {
                                    var e = mt(t.id) || n.getIntersection(t);
                                    e && e.releaseCapture(t.id),
                                    e && e.isListening() && (s[e._id] || (s[e._id] = !0,
                                    (n.tapEndShape = e)._fireAndBubble(Ot, {
                                        evt: i,
                                        pointerId: t.id
                                    }),
                                    a = !0,
                                    G.listenClickTap && e === n.tapStartShape && (h = !0,
                                    e._fireAndBubble("tap", {
                                        evt: i,
                                        pointerId: t.id
                                    }),
                                    o && r && r === e && (l = !0,
                                    e._fireAndBubble("dbltap", {
                                        evt: i,
                                        pointerId: t.id
                                    }))),
                                    e.isListening() && e.preventDefault() && i.cancelable && i.preventDefault()))
                                }),
                                a || this._fire(Ot, {
                                    evt: i,
                                    target: this,
                                    currentTarget: this,
                                    pointerId: this._changedPointerPositions[0].id
                                }),
                                G.listenClickTap && !h && (this.tapEndShape = null,
                                this._fire("tap", {
                                    evt: i,
                                    target: this,
                                    currentTarget: this,
                                    pointerId: this._changedPointerPositions[0].id
                                })),
                                o && !l && this._fire("dbltap", {
                                    evt: i,
                                    target: this,
                                    currentTarget: this,
                                    pointerId: this._changedPointerPositions[0].id
                                }),
                                this._fire("contentTouchend", {
                                    evt: i
                                }),
                                G.listenClickTap && (this._fire("contentTap", {
                                    evt: i
                                }),
                                o && this._fire("contentDbltap", {
                                    evt: i
                                })),
                                this.preventDefault() && i.cancelable && i.preventDefault(),
                                G.listenClickTap = !1
                            }
                            ,
                            qt.prototype._wheel = function(t) {
                                this.setPointersPositions(t);
                                var e = this.getIntersection(this.getPointerPosition());
                                e && e.isListening() ? e._fireAndBubble(Bt, {
                                    evt: t
                                }) : this._fire(Bt, {
                                    evt: t,
                                    target: this,
                                    currentTarget: this
                                }),
                                this._fire("contentWheel", {
                                    evt: t
                                })
                            }
                            ,
                            qt.prototype._pointerdown = function(t) {
                                var e;
                                G._pointerEventsEnabled && (this.setPointersPositions(t),
                                (e = mt(t.pointerId) || this.getIntersection(this.getPointerPosition())) && e._fireAndBubble(Rt, _t(t)))
                            }
                            ,
                            qt.prototype._pointermove = function(t) {
                                var e;
                                G._pointerEventsEnabled && (this.setPointersPositions(t),
                                (e = mt(t.pointerId) || this.getIntersection(this.getPointerPosition())) && e._fireAndBubble(Gt, _t(t)))
                            }
                            ,
                            qt.prototype._pointerup = function(t) {
                                var e;
                                G._pointerEventsEnabled && (this.setPointersPositions(t),
                                (e = mt(t.pointerId) || this.getIntersection(this.getPointerPosition())) && e._fireAndBubble(Et, _t(t)),
                                St(t.pointerId))
                            }
                            ,
                            qt.prototype._pointercancel = function(t) {
                                var e;
                                G._pointerEventsEnabled && (this.setPointersPositions(t),
                                (e = mt(t.pointerId) || this.getIntersection(this.getPointerPosition())) && e._fireAndBubble(Et, _t(t)),
                                St(t.pointerId))
                            }
                            ,
                            qt.prototype._lostpointercapture = function(t) {
                                St(t.pointerId)
                            }
                            ,
                            qt.prototype.setPointersPositions = function(t) {
                                var e = this
                                  , i = this._getContentPosition()
                                  , n = null
                                  , r = null;
                                void 0 !== (t = t || window.event).touches ? (this._pointerPositions = [],
                                this._changedPointerPositions = [],
                                o.prototype.each.call(t.touches, function(t) {
                                    e._pointerPositions.push({
                                        id: t.identifier,
                                        x: (t.clientX - i.left) / i.scaleX,
                                        y: (t.clientY - i.top) / i.scaleY
                                    })
                                }),
                                o.prototype.each.call(t.changedTouches || t.touches, function(t) {
                                    e._changedPointerPositions.push({
                                        id: t.identifier,
                                        x: (t.clientX - i.left) / i.scaleX,
                                        y: (t.clientY - i.top) / i.scaleY
                                    })
                                })) : (n = (t.clientX - i.left) / i.scaleX,
                                r = (t.clientY - i.top) / i.scaleY,
                                this.pointerPos = {
                                    x: n,
                                    y: r
                                },
                                this._pointerPositions = [{
                                    x: n,
                                    y: r,
                                    id: A._getFirstPointerId(t)
                                }],
                                this._changedPointerPositions = [{
                                    x: n,
                                    y: r,
                                    id: A._getFirstPointerId(t)
                                }])
                            }
                            ,
                            qt.prototype._setPointerPosition = function(t) {
                                A.warn('Method _setPointerPosition is deprecated. Use "stage.setPointersPositions(event)" instead.'),
                                this.setPointersPositions(t)
                            }
                            ,
                            qt.prototype._getContentPosition = function() {
                                if (!this.content || !this.content.getBoundingClientRect)
                                    return {
                                        top: 0,
                                        left: 0,
                                        scaleX: 1,
                                        scaleY: 1
                                    };
                                var t = this.content.getBoundingClientRect();
                                return {
                                    top: t.top,
                                    left: t.left,
                                    scaleX: t.width / this.content.clientWidth || 1,
                                    scaleY: t.height / this.content.clientHeight || 1
                                }
                            }
                            ,
                            qt.prototype._buildDOM = function() {
                                if (this.bufferCanvas = new H({
                                    width: this.width(),
                                    height: this.height()
                                }),
                                this.bufferHitCanvas = new j({
                                    pixelRatio: 1,
                                    width: this.width(),
                                    height: this.height()
                                }),
                                G.isBrowser) {
                                    var t = this.container();
                                    if (!t)
                                        throw "Stage has no container. A container is required.";
                                    t.innerHTML = "",
                                    this.content = document.createElement("div"),
                                    this.content.style.position = "relative",
                                    this.content.style.userSelect = "none",
                                    this.content.className = "konvajs-content",
                                    this.content.setAttribute("role", "presentation"),
                                    t.appendChild(this.content),
                                    this._resizeDOM()
                                }
                            }
                            ,
                            qt.prototype.cache = function() {
                                return A.warn("Cache function is not allowed for stage. You may use cache only for layers, groups and shapes."),
                                this
                            }
                            ,
                            qt.prototype.clearCache = function() {
                                return this
                            }
                            ,
                            qt.prototype.batchDraw = function() {
                                return this.children.each(function(t) {
                                    t.batchDraw()
                                }),
                                this
                            }
                            ,
                            qt);
                            function qt(t) {
                                var e = jt.call(this, Xt(t)) || this;
                                return e._pointerPositions = [],
                                e._changedPointerPositions = [],
                                e._buildDOM(),
                                e._bindContentEvents(),
                                Yt.push(e),
                                e.on("widthChange.konva heightChange.konva", e._resizeDOM),
                                e.on("visibleChange.konva", e._checkVisibility),
                                e.on("clipWidthChange.konva clipHeightChange.konva clipFuncChange.konva", function() {
                                    Xt(e.attrs)
                                }),
                                e._checkVisibility(),
                                e
                            }
                            Ut.prototype.nodeType = "Stage",
                            i(Ut),
                            w.addGetterSetter(Ut, "container");
                            var Kt, Vt = "hasShadow", Qt = "shadowRGBA", Jt = "patternImage", Zt = "linearGradient", $t = "radialGradient";
                            function te() {
                                return Kt || (Kt = A.createCanvasElement().getContext("2d"))
                            }
                            var ee = {};
                            function ie() {
                                this._clearCache(Vt)
                            }
                            function ne() {
                                this._clearCache(Qt)
                            }
                            function re() {
                                this._clearCache(Jt)
                            }
                            function oe() {
                                this._clearCache(Zt)
                            }
                            function ae() {
                                this._clearCache($t)
                            }
                            var se, he = (P(le, se = ct),
                            le.prototype.getContext = function() {
                                return this.getLayer().getContext()
                            }
                            ,
                            le.prototype.getCanvas = function() {
                                return this.getLayer().getCanvas()
                            }
                            ,
                            le.prototype.getSceneFunc = function() {
                                return this.attrs.sceneFunc || this._sceneFunc
                            }
                            ,
                            le.prototype.getHitFunc = function() {
                                return this.attrs.hitFunc || this._hitFunc
                            }
                            ,
                            le.prototype.hasShadow = function() {
                                return this._getCache(Vt, this._hasShadow)
                            }
                            ,
                            le.prototype._hasShadow = function() {
                                return this.shadowEnabled() && 0 !== this.shadowOpacity() && !!(this.shadowColor() || this.shadowBlur() || this.shadowOffsetX() || this.shadowOffsetY())
                            }
                            ,
                            le.prototype._getFillPattern = function() {
                                return this._getCache(Jt, this.__getFillPattern)
                            }
                            ,
                            le.prototype.__getFillPattern = function() {
                                if (this.fillPatternImage())
                                    return te().createPattern(this.fillPatternImage(), this.fillPatternRepeat() || "repeat")
                            }
                            ,
                            le.prototype._getLinearGradient = function() {
                                return this._getCache(Zt, this.__getLinearGradient)
                            }
                            ,
                            le.prototype.__getLinearGradient = function() {
                                var t = this.fillLinearGradientColorStops();
                                if (t) {
                                    for (var e = te(), i = this.fillLinearGradientStartPoint(), n = this.fillLinearGradientEndPoint(), r = e.createLinearGradient(i.x, i.y, n.x, n.y), o = 0; o < t.length; o += 2)
                                        r.addColorStop(t[o], t[o + 1]);
                                    return r
                                }
                            }
                            ,
                            le.prototype._getRadialGradient = function() {
                                return this._getCache($t, this.__getRadialGradient)
                            }
                            ,
                            le.prototype.__getRadialGradient = function() {
                                var t = this.fillRadialGradientColorStops();
                                if (t) {
                                    for (var e = te(), i = this.fillRadialGradientStartPoint(), n = this.fillRadialGradientEndPoint(), r = e.createRadialGradient(i.x, i.y, this.fillRadialGradientStartRadius(), n.x, n.y, this.fillRadialGradientEndRadius()), o = 0; o < t.length; o += 2)
                                        r.addColorStop(t[o], t[o + 1]);
                                    return r
                                }
                            }
                            ,
                            le.prototype.getShadowRGBA = function() {
                                return this._getCache(Qt, this._getShadowRGBA)
                            }
                            ,
                            le.prototype._getShadowRGBA = function() {
                                if (this.hasShadow()) {
                                    var t = A.colorToRGBA(this.shadowColor());
                                    return "rgba(" + t.r + "," + t.g + "," + t.b + "," + t.a * (this.shadowOpacity() || 1) + ")"
                                }
                            }
                            ,
                            le.prototype.hasFill = function() {
                                var t = this;
                                return this._calculate("hasFill", ["fillEnabled", "fill", "fillPatternImage", "fillLinearGradientColorStops", "fillRadialGradientColorStops"], function() {
                                    return t.fillEnabled() && !!(t.fill() || t.fillPatternImage() || t.fillLinearGradientColorStops() || t.fillRadialGradientColorStops())
                                })
                            }
                            ,
                            le.prototype.hasStroke = function() {
                                var t = this;
                                return this._calculate("hasStroke", ["strokeEnabled", "strokeWidth", "stroke", "strokeLinearGradientColorStops"], function() {
                                    return t.strokeEnabled() && t.strokeWidth() && !(!t.stroke() && !t.strokeLinearGradientColorStops())
                                })
                            }
                            ,
                            le.prototype.hasHitStroke = function() {
                                var t = this.hitStrokeWidth();
                                return "auto" === t ? this.hasStroke() : this.strokeEnabled() && !!t
                            }
                            ,
                            le.prototype.intersects = function(t) {
                                var e = this.getStage().bufferHitCanvas;
                                return e.getContext().clear(),
                                this.drawHit(e),
                                0 < e.context.getImageData(Math.round(t.x), Math.round(t.y), 1, 1).data[3]
                            }
                            ,
                            le.prototype.destroy = function() {
                                return ct.prototype.destroy.call(this),
                                delete ee[this.colorKey],
                                delete this.colorKey,
                                this
                            }
                            ,
                            le.prototype._useBufferCanvas = function(t) {
                                var e;
                                if (!this.getStage())
                                    return !1;
                                if (null !== (e = this.attrs.perfectDrawEnabled) && void 0 !== e && !e)
                                    return !1;
                                var i = t || this.hasFill()
                                  , n = this.hasStroke()
                                  , r = 1 !== this.getAbsoluteOpacity();
                                if (i && n && r)
                                    return !0;
                                var o = this.hasShadow()
                                  , a = this.shadowForStrokeEnabled();
                                return !!(i && n && o && a)
                            }
                            ,
                            le.prototype.setStrokeHitEnabled = function(t) {
                                A.warn("strokeHitEnabled property is deprecated. Please use hitStrokeWidth instead."),
                                t ? this.hitStrokeWidth("auto") : this.hitStrokeWidth(0)
                            }
                            ,
                            le.prototype.getStrokeHitEnabled = function() {
                                return 0 !== this.hitStrokeWidth()
                            }
                            ,
                            le.prototype.getSelfRect = function() {
                                var t = this.size();
                                return {
                                    x: this._centroid ? -t.width / 2 : 0,
                                    y: this._centroid ? -t.height / 2 : 0,
                                    width: t.width,
                                    height: t.height
                                }
                            }
                            ,
                            le.prototype.getClientRect = function(t) {
                                var e = (t = t || {}).skipTransform
                                  , i = t.relativeTo
                                  , n = this.getSelfRect()
                                  , r = !t.skipStroke && this.hasStroke() && this.strokeWidth() || 0
                                  , o = n.width + r
                                  , a = n.height + r
                                  , s = !t.skipShadow && this.hasShadow()
                                  , h = s ? this.shadowOffsetX() : 0
                                  , l = s ? this.shadowOffsetY() : 0
                                  , c = o + Math.abs(h)
                                  , d = a + Math.abs(l)
                                  , p = s && this.shadowBlur() || 0
                                  , u = c + 2 * p
                                  , f = d + 2 * p
                                  , g = 0;
                                Math.round(r / 2) !== r / 2 && (g = 1);
                                var v = {
                                    width: u + g,
                                    height: f + g,
                                    x: -Math.round(r / 2 + p) + Math.min(h, 0) + n.x,
                                    y: -Math.round(r / 2 + p) + Math.min(l, 0) + n.y
                                };
                                return e ? v : this._transformedRect(v, i)
                            }
                            ,
                            le.prototype.drawScene = function(t, e) {
                                var i, n, r, o, a = this.getLayer(), s = t || a.getCanvas(), h = s.getContext(), l = this._getCanvasCache(), c = this.getSceneFunc(), d = this.hasShadow(), p = s.isCache, u = s.isCache, f = e === this;
                                if (!this.isVisible() && !p)
                                    return this;
                                if (l) {
                                    h.save();
                                    var g = this.getAbsoluteTransform(e).getMatrix();
                                    return h.transform(g[0], g[1], g[2], g[3], g[4], g[5]),
                                    this._drawCachedSceneCanvas(h),
                                    h.restore(),
                                    this
                                }
                                return c && (h.save(),
                                this._useBufferCanvas() && !u ? ((n = (i = this.getStage().bufferCanvas).getContext()).clear(),
                                n.save(),
                                n._applyLineJoin(this),
                                o = this.getAbsoluteTransform(e).getMatrix(),
                                n.transform(o[0], o[1], o[2], o[3], o[4], o[5]),
                                c.call(this, n, this),
                                n.restore(),
                                r = i.pixelRatio,
                                d && h._applyShadow(this),
                                h._applyOpacity(this),
                                h._applyGlobalCompositeOperation(this),
                                h.drawImage(i._canvas, 0, 0, i.width / r, i.height / r)) : (h._applyLineJoin(this),
                                f || (o = this.getAbsoluteTransform(e).getMatrix(),
                                h.transform(o[0], o[1], o[2], o[3], o[4], o[5]),
                                h._applyOpacity(this),
                                h._applyGlobalCompositeOperation(this)),
                                d && h._applyShadow(this),
                                c.call(this, h, this)),
                                h.restore()),
                                this
                            }
                            ,
                            le.prototype.drawHit = function(t, e) {
                                if (!this.shouldDrawHit(e))
                                    return this;
                                var i, n = this.getLayer(), r = t || n.hitCanvas, o = r && r.getContext(), a = this.hitFunc() || this.sceneFunc(), s = this._getCanvasCache(), h = s && s.hit;
                                if (this.colorKey || (console.log(this),
                                A.warn("Looks like your canvas has a destroyed shape in it. Do not reuse shape after you destroyed it. See the shape in logs above. If you want to reuse shape you should call remove() instead of destroy()")),
                                h) {
                                    o.save();
                                    var l = this.getAbsoluteTransform(e).getMatrix();
                                    return o.transform(l[0], l[1], l[2], l[3], l[4], l[5]),
                                    this._drawCachedHitCanvas(o),
                                    o.restore(),
                                    this
                                }
                                return a && (o.save(),
                                o._applyLineJoin(this),
                                this === e || (i = this.getAbsoluteTransform(e).getMatrix(),
                                o.transform(i[0], i[1], i[2], i[3], i[4], i[5])),
                                a.call(this, o, this),
                                o.restore()),
                                this
                            }
                            ,
                            le.prototype.drawHitFromCache = function(t) {
                                void 0 === t && (t = 0);
                                var e, i, n, r, o, a = this._getCanvasCache(), s = this._getCachedSceneCanvas(), h = a.hit, l = h.getContext(), c = h.getWidth(), d = h.getHeight();
                                l.clear(),
                                l.drawImage(s._canvas, 0, 0, c, d);
                                try {
                                    for (n = (i = (e = l.getImageData(0, 0, c, d)).data).length,
                                    r = A._hexToRgb(this.colorKey),
                                    o = 0; o < n; o += 4)
                                        t < i[o + 3] ? (i[o] = r.r,
                                        i[o + 1] = r.g,
                                        i[o + 2] = r.b,
                                        i[o + 3] = 255) : i[o + 3] = 0;
                                    l.putImageData(e, 0, 0)
                                } catch (t) {
                                    A.error("Unable to draw hit graph from cached scene canvas. " + t.message)
                                }
                                return this
                            }
                            ,
                            le.prototype.hasPointerCapture = function(t) {
                                return bt(t, this)
                            }
                            ,
                            le.prototype.setPointerCapture = function(t) {
                                xt(t, this)
                            }
                            ,
                            le.prototype.releaseCapture = function(t) {
                                St(t)
                            }
                            ,
                            le);
                            function le(t) {
                                for (var e, i = se.call(this, t) || this; !(e = A.getRandomColor()) || e in ee; )
                                    ;
                                return i.colorKey = e,
                                (ee[e] = i).on("shadowColorChange.konva shadowBlurChange.konva shadowOffsetChange.konva shadowOpacityChange.konva shadowEnabledChange.konva", ie),
                                i.on("shadowColorChange.konva shadowOpacityChange.konva shadowEnabledChange.konva", ne),
                                i.on("fillPriorityChange.konva fillPatternImageChange.konva fillPatternRepeatChange.konva fillPatternScaleXChange.konva fillPatternScaleYChange.konva", re),
                                i.on("fillPriorityChange.konva fillLinearGradientColorStopsChange.konva fillLinearGradientStartPointXChange.konva fillLinearGradientStartPointYChange.konva fillLinearGradientEndPointXChange.konva fillLinearGradientEndPointYChange.konva", oe),
                                i.on("fillPriorityChange.konva fillRadialGradientColorStopsChange.konva fillRadialGradientStartPointXChange.konva fillRadialGradientStartPointYChange.konva fillRadialGradientEndPointXChange.konva fillRadialGradientEndPointYChange.konva fillRadialGradientStartRadiusChange.konva fillRadialGradientEndRadiusChange.konva", ae),
                                i
                            }
                            he.prototype._fillFunc = function(t) {
                                t.fill()
                            }
                            ,
                            he.prototype._strokeFunc = function(t) {
                                t.stroke()
                            }
                            ,
                            he.prototype._fillFuncHit = function(t) {
                                t.fill()
                            }
                            ,
                            he.prototype._strokeFuncHit = function(t) {
                                t.stroke()
                            }
                            ,
                            he.prototype._centroid = !1,
                            he.prototype.nodeType = "Shape",
                            i(he),
                            w.addGetterSetter(he, "stroke", void 0, _()),
                            w.addGetterSetter(he, "strokeWidth", 2, y()),
                            w.addGetterSetter(he, "hitStrokeWidth", "auto", m()),
                            w.addGetterSetter(he, "strokeHitEnabled", !0, b()),
                            w.addGetterSetter(he, "perfectDrawEnabled", !0, b()),
                            w.addGetterSetter(he, "shadowForStrokeEnabled", !0, b()),
                            w.addGetterSetter(he, "lineJoin"),
                            w.addGetterSetter(he, "lineCap"),
                            w.addGetterSetter(he, "sceneFunc"),
                            w.addGetterSetter(he, "hitFunc"),
                            w.addGetterSetter(he, "dash"),
                            w.addGetterSetter(he, "dashOffset", 0, y()),
                            w.addGetterSetter(he, "shadowColor", void 0, _()),
                            w.addGetterSetter(he, "shadowBlur", 0, y()),
                            w.addGetterSetter(he, "shadowOpacity", 1, y()),
                            w.addComponentsGetterSetter(he, "shadowOffset", ["x", "y"]),
                            w.addGetterSetter(he, "shadowOffsetX", 0, y()),
                            w.addGetterSetter(he, "shadowOffsetY", 0, y()),
                            w.addGetterSetter(he, "fillPatternImage"),
                            w.addGetterSetter(he, "fill", void 0, _()),
                            w.addGetterSetter(he, "fillPatternX", 0, y()),
                            w.addGetterSetter(he, "fillPatternY", 0, y()),
                            w.addGetterSetter(he, "fillLinearGradientColorStops"),
                            w.addGetterSetter(he, "strokeLinearGradientColorStops"),
                            w.addGetterSetter(he, "fillRadialGradientStartRadius", 0),
                            w.addGetterSetter(he, "fillRadialGradientEndRadius", 0),
                            w.addGetterSetter(he, "fillRadialGradientColorStops"),
                            w.addGetterSetter(he, "fillPatternRepeat", "repeat"),
                            w.addGetterSetter(he, "fillEnabled", !0),
                            w.addGetterSetter(he, "strokeEnabled", !0),
                            w.addGetterSetter(he, "shadowEnabled", !0),
                            w.addGetterSetter(he, "dashEnabled", !0),
                            w.addGetterSetter(he, "strokeScaleEnabled", !0),
                            w.addGetterSetter(he, "fillPriority", "color"),
                            w.addComponentsGetterSetter(he, "fillPatternOffset", ["x", "y"]),
                            w.addGetterSetter(he, "fillPatternOffsetX", 0, y()),
                            w.addGetterSetter(he, "fillPatternOffsetY", 0, y()),
                            w.addComponentsGetterSetter(he, "fillPatternScale", ["x", "y"]),
                            w.addGetterSetter(he, "fillPatternScaleX", 1, y()),
                            w.addGetterSetter(he, "fillPatternScaleY", 1, y()),
                            w.addComponentsGetterSetter(he, "fillLinearGradientStartPoint", ["x", "y"]),
                            w.addComponentsGetterSetter(he, "strokeLinearGradientStartPoint", ["x", "y"]),
                            w.addGetterSetter(he, "fillLinearGradientStartPointX", 0),
                            w.addGetterSetter(he, "strokeLinearGradientStartPointX", 0),
                            w.addGetterSetter(he, "fillLinearGradientStartPointY", 0),
                            w.addGetterSetter(he, "strokeLinearGradientStartPointY", 0),
                            w.addComponentsGetterSetter(he, "fillLinearGradientEndPoint", ["x", "y"]),
                            w.addComponentsGetterSetter(he, "strokeLinearGradientEndPoint", ["x", "y"]),
                            w.addGetterSetter(he, "fillLinearGradientEndPointX", 0),
                            w.addGetterSetter(he, "strokeLinearGradientEndPointX", 0),
                            w.addGetterSetter(he, "fillLinearGradientEndPointY", 0),
                            w.addGetterSetter(he, "strokeLinearGradientEndPointY", 0),
                            w.addComponentsGetterSetter(he, "fillRadialGradientStartPoint", ["x", "y"]),
                            w.addGetterSetter(he, "fillRadialGradientStartPointX", 0),
                            w.addGetterSetter(he, "fillRadialGradientStartPointY", 0),
                            w.addComponentsGetterSetter(he, "fillRadialGradientEndPoint", ["x", "y"]),
                            w.addGetterSetter(he, "fillRadialGradientEndPointX", 0),
                            w.addGetterSetter(he, "fillRadialGradientEndPointY", 0),
                            w.addGetterSetter(he, "fillPatternRotation", 0),
                            w.backCompat(he, {
                                dashArray: "dash",
                                getDashArray: "getDash",
                                setDashArray: "getDash",
                                drawFunc: "sceneFunc",
                                getDrawFunc: "getSceneFunc",
                                setDrawFunc: "setSceneFunc",
                                drawHitFunc: "hitFunc",
                                getDrawHitFunc: "getHitFunc",
                                setDrawHitFunc: "setHitFunc"
                            }),
                            o.mapMethods(he);
                            var ce, de = [{
                                x: 0,
                                y: 0
                            }, {
                                x: -1,
                                y: -1
                            }, {
                                x: 1,
                                y: -1
                            }, {
                                x: 1,
                                y: 1
                            }, {
                                x: -1,
                                y: 1
                            }], pe = de.length, ue = (P(fe, ce = ft),
                            fe.prototype.createPNGStream = function() {
                                return this.canvas._canvas.createPNGStream()
                            }
                            ,
                            fe.prototype.getCanvas = function() {
                                return this.canvas
                            }
                            ,
                            fe.prototype.getHitCanvas = function() {
                                return this.hitCanvas
                            }
                            ,
                            fe.prototype.getContext = function() {
                                return this.getCanvas().getContext()
                            }
                            ,
                            fe.prototype.clear = function(t) {
                                return this.getContext().clear(t),
                                this.getHitCanvas().getContext().clear(t),
                                this
                            }
                            ,
                            fe.prototype.setZIndex = function(t) {
                                ce.prototype.setZIndex.call(this, t);
                                var e = this.getStage();
                                return e && (e.content.removeChild(this.getCanvas()._canvas),
                                t < e.children.length - 1 ? e.content.insertBefore(this.getCanvas()._canvas, e.children[t + 1].getCanvas()._canvas) : e.content.appendChild(this.getCanvas()._canvas)),
                                this
                            }
                            ,
                            fe.prototype.moveToTop = function() {
                                ct.prototype.moveToTop.call(this);
                                var t = this.getStage();
                                return t && (t.content.removeChild(this.getCanvas()._canvas),
                                t.content.appendChild(this.getCanvas()._canvas)),
                                !0
                            }
                            ,
                            fe.prototype.moveUp = function() {
                                if (!ct.prototype.moveUp.call(this))
                                    return !1;
                                var t = this.getStage();
                                return !!t && (t.content.removeChild(this.getCanvas()._canvas),
                                this.index < t.children.length - 1 ? t.content.insertBefore(this.getCanvas()._canvas, t.children[this.index + 1].getCanvas()._canvas) : t.content.appendChild(this.getCanvas()._canvas),
                                !0)
                            }
                            ,
                            fe.prototype.moveDown = function() {
                                if (ct.prototype.moveDown.call(this)) {
                                    var t, e = this.getStage();
                                    return e && (t = e.children,
                                    e.content.removeChild(this.getCanvas()._canvas),
                                    e.content.insertBefore(this.getCanvas()._canvas, t[this.index + 1].getCanvas()._canvas)),
                                    !0
                                }
                                return !1
                            }
                            ,
                            fe.prototype.moveToBottom = function() {
                                if (ct.prototype.moveToBottom.call(this)) {
                                    var t, e = this.getStage();
                                    return e && (t = e.children,
                                    e.content.removeChild(this.getCanvas()._canvas),
                                    e.content.insertBefore(this.getCanvas()._canvas, t[1].getCanvas()._canvas)),
                                    !0
                                }
                                return !1
                            }
                            ,
                            fe.prototype.getLayer = function() {
                                return this
                            }
                            ,
                            fe.prototype.remove = function() {
                                var t = this.getCanvas()._canvas;
                                return ct.prototype.remove.call(this),
                                t && t.parentNode && A._isInDocument(t) && t.parentNode.removeChild(t),
                                this
                            }
                            ,
                            fe.prototype.getStage = function() {
                                return this.parent
                            }
                            ,
                            fe.prototype.setSize = function(t) {
                                var e = t.width
                                  , i = t.height;
                                return this.canvas.setSize(e, i),
                                this.hitCanvas.setSize(e, i),
                                this._setSmoothEnabled(),
                                this
                            }
                            ,
                            fe.prototype._validateAdd = function(t) {
                                var e = t.getType();
                                "Group" !== e && "Shape" !== e && A.throw("You may only add groups and shapes to a layer.")
                            }
                            ,
                            fe.prototype._toKonvaCanvas = function(t) {
                                return (t = t || {}).width = t.width || this.getWidth(),
                                t.height = t.height || this.getHeight(),
                                t.x = void 0 !== t.x ? t.x : this.x(),
                                t.y = void 0 !== t.y ? t.y : this.y(),
                                ct.prototype._toKonvaCanvas.call(this, t)
                            }
                            ,
                            fe.prototype._checkVisibility = function() {
                                var t = this.visible();
                                this.canvas._canvas.style.display = t ? "block" : "none"
                            }
                            ,
                            fe.prototype._setSmoothEnabled = function() {
                                this.getContext()._context.imageSmoothingEnabled = this.imageSmoothingEnabled()
                            }
                            ,
                            fe.prototype.getWidth = function() {
                                if (this.parent)
                                    return this.parent.width()
                            }
                            ,
                            fe.prototype.setWidth = function() {
                                A.warn('Can not change width of layer. Use "stage.width(value)" function instead.')
                            }
                            ,
                            fe.prototype.getHeight = function() {
                                if (this.parent)
                                    return this.parent.height()
                            }
                            ,
                            fe.prototype.setHeight = function() {
                                A.warn('Can not change height of layer. Use "stage.height(value)" function instead.')
                            }
                            ,
                            fe.prototype.batchDraw = function() {
                                var t = this;
                                return this._waitingForDraw || (this._waitingForDraw = !0,
                                A.requestAnimFrame(function() {
                                    t.draw(),
                                    t._waitingForDraw = !1
                                })),
                                this
                            }
                            ,
                            fe.prototype.getIntersection = function(t, e) {
                                var i, n, r, o;
                                if (!this.isListening() || !this.isVisible())
                                    return null;
                                for (var a = 1, s = !1; ; ) {
                                    for (n = 0; n < pe; n++) {
                                        if (r = de[n],
                                        (o = (i = this._getIntersection({
                                            x: t.x + r.x * a,
                                            y: t.y + r.y * a
                                        })).shape) && e)
                                            return o.findAncestor(e, !0);
                                        if (o)
                                            return o;
                                        if (s = !!i.antialiased,
                                        !i.antialiased)
                                            break
                                    }
                                    if (!s)
                                        return null;
                                    a += 1
                                }
                            }
                            ,
                            fe.prototype._getIntersection = function(t) {
                                var e, i, n = this.hitCanvas.pixelRatio, r = this.hitCanvas.context.getImageData(Math.round(t.x * n), Math.round(t.y * n), 1, 1).data, o = r[3];
                                return 255 === o ? (e = A._rgbToHex(r[0], r[1], r[2]),
                                (i = ee["#" + e]) ? {
                                    shape: i
                                } : {
                                    antialiased: !0
                                }) : 0 < o ? {
                                    antialiased: !0
                                } : {}
                            }
                            ,
                            fe.prototype.drawScene = function(t, e) {
                                var i = this.getLayer()
                                  , n = t || i && i.getCanvas();
                                return this._fire("beforeDraw", {
                                    node: this
                                }),
                                this.clearBeforeDraw() && n.getContext().clear(),
                                ft.prototype.drawScene.call(this, n, e),
                                this._fire("draw", {
                                    node: this
                                }),
                                this
                            }
                            ,
                            fe.prototype.drawHit = function(t, e) {
                                var i = this.getLayer()
                                  , n = t || i && i.hitCanvas;
                                return i && i.clearBeforeDraw() && i.getHitCanvas().getContext().clear(),
                                ft.prototype.drawHit.call(this, n, e),
                                this
                            }
                            ,
                            fe.prototype.enableHitGraph = function() {
                                return this.hitGraphEnabled(!0),
                                this
                            }
                            ,
                            fe.prototype.disableHitGraph = function() {
                                return this.hitGraphEnabled(!1),
                                this
                            }
                            ,
                            fe.prototype.setHitGraphEnabled = function(t) {
                                A.warn("hitGraphEnabled method is deprecated. Please use layer.listening() instead."),
                                this.listening(t)
                            }
                            ,
                            fe.prototype.getHitGraphEnabled = function(t) {
                                return A.warn("hitGraphEnabled method is deprecated. Please use layer.listening() instead."),
                                this.listening()
                            }
                            ,
                            fe.prototype.toggleHitCanvas = function() {
                                var t;
                                this.parent && (t = this.parent,
                                this.hitCanvas._canvas.parentNode ? t.content.removeChild(this.hitCanvas._canvas) : t.content.appendChild(this.hitCanvas._canvas))
                            }
                            ,
                            fe);
                            function fe(t) {
                                var e = ce.call(this, t) || this;
                                return e.canvas = new H,
                                e.hitCanvas = new j({
                                    pixelRatio: 1
                                }),
                                e._waitingForDraw = !1,
                                e.on("visibleChange.konva", e._checkVisibility),
                                e._checkVisibility(),
                                e.on("imageSmoothingEnabledChange.konva", e._setSmoothEnabled),
                                e._setSmoothEnabled(),
                                e
                            }
                            ue.prototype.nodeType = "Layer",
                            i(ue),
                            w.addGetterSetter(ue, "imageSmoothingEnabled", !0),
                            w.addGetterSetter(ue, "clearBeforeDraw", !0),
                            w.addGetterSetter(ue, "hitGraphEnabled", !0, b()),
                            o.mapMethods(ue);
                            var ge, ve = (P(ye, ge = ue),
                            ye);
                            function ye(t) {
                                var e = ge.call(this, t) || this;
                                return e.listening(!1),
                                A.warn('Konva.Fast layer is deprecated. Please use "new Konva.Layer({ listening: false })" instead.'),
                                e
                            }
                            ve.prototype.nodeType = "FastLayer",
                            i(ve),
                            o.mapMethods(ve);
                            var me, _e = (P(be, me = ft),
                            be.prototype._validateAdd = function(t) {
                                var e = t.getType();
                                "Group" !== e && "Shape" !== e && A.throw("You may only add groups and shapes to groups.")
                            }
                            ,
                            be);
                            function be() {
                                return null !== me && me.apply(this, arguments) || this
                            }
                            _e.prototype.nodeType = "Group",
                            i(_e),
                            o.mapMethods(_e);
                            var xe = n.performance && n.performance.now ? function() {
                                return n.performance.now()
                            }
                            : function() {
                                return (new Date).getTime()
                            }
                              , Se = (we.prototype.setLayers = function(t) {
                                var e = []
                                  , e = t ? 0 < t.length ? t : [t] : [];
                                return this.layers = e,
                                this
                            }
                            ,
                            we.prototype.getLayers = function() {
                                return this.layers
                            }
                            ,
                            we.prototype.addLayer = function(t) {
                                for (var e = this.layers, i = e.length, n = 0; n < i; n++)
                                    if (e[n]._id === t._id)
                                        return !1;
                                return this.layers.push(t),
                                !0
                            }
                            ,
                            we.prototype.isRunning = function() {
                                for (var t = we.animations, e = t.length, i = 0; i < e; i++)
                                    if (t[i].id === this.id)
                                        return !0;
                                return !1
                            }
                            ,
                            we.prototype.start = function() {
                                return this.stop(),
                                this.frame.timeDiff = 0,
                                this.frame.lastTime = xe(),
                                we._addAnimation(this),
                                this
                            }
                            ,
                            we.prototype.stop = function() {
                                return we._removeAnimation(this),
                                this
                            }
                            ,
                            we.prototype._updateFrameObject = function(t) {
                                this.frame.timeDiff = t - this.frame.lastTime,
                                this.frame.lastTime = t,
                                this.frame.time += this.frame.timeDiff,
                                this.frame.frameRate = 1e3 / this.frame.timeDiff
                            }
                            ,
                            we._addAnimation = function(t) {
                                this.animations.push(t),
                                this._handleAnimation()
                            }
                            ,
                            we._removeAnimation = function(t) {
                                for (var e = t.id, i = this.animations, n = i.length, r = 0; r < n; r++)
                                    if (i[r].id === e) {
                                        this.animations.splice(r, 1);
                                        break
                                    }
                            }
                            ,
                            we._runFrames = function() {
                                for (var t, e, i, n, r, o, a, s = {}, h = this.animations, l = 0; l < h.length; l++)
                                    if (e = (t = h[l]).layers,
                                    i = t.func,
                                    t._updateFrameObject(xe()),
                                    r = e.length,
                                    !i || !1 !== i.call(t, t.frame))
                                        for (n = 0; n < r; n++)
                                            void 0 !== (o = e[n])._id && (s[o._id] = o);
                                for (a in s)
                                    s.hasOwnProperty(a) && s[a].draw()
                            }
                            ,
                            we._animationLoop = function() {
                                var t = we;
                                t.animations.length ? (t._runFrames(),
                                requestAnimationFrame(t._animationLoop)) : t.animRunning = !1
                            }
                            ,
                            we._handleAnimation = function() {
                                this.animRunning || (this.animRunning = !0,
                                requestAnimationFrame(this._animationLoop))
                            }
                            ,
                            we.animations = [],
                            we.animIdCounter = 0,
                            we.animRunning = !1,
                            we);
                            function we(t, e) {
                                this.id = we.animIdCounter++,
                                this.frame = {
                                    time: 0,
                                    timeDiff: 0,
                                    lastTime: xe(),
                                    frameRate: 0
                                },
                                this.func = t,
                                this.setLayers(e)
                            }
                            var Ce = {
                                node: 1,
                                duration: 1,
                                easing: 1,
                                onFinish: 1,
                                yoyo: 1
                            }
                              , Pe = 0
                              , ke = ["fill", "stroke", "shadowColor"]
                              , Te = (Ae.prototype.fire = function(t) {
                                var e = this[t];
                                e && e()
                            }
                            ,
                            Ae.prototype.setTime = function(t) {
                                t > this.duration ? this.yoyo ? (this._time = this.duration,
                                this.reverse()) : this.finish() : t < 0 ? this.yoyo ? (this._time = 0,
                                this.play()) : this.reset() : (this._time = t,
                                this.update())
                            }
                            ,
                            Ae.prototype.getTime = function() {
                                return this._time
                            }
                            ,
                            Ae.prototype.setPosition = function(t) {
                                this.prevPos = this._pos,
                                this.propFunc(t),
                                this._pos = t
                            }
                            ,
                            Ae.prototype.getPosition = function(t) {
                                return void 0 === t && (t = this._time),
                                this.func(t, this.begin, this._change, this.duration)
                            }
                            ,
                            Ae.prototype.play = function() {
                                this.state = 2,
                                this._startTime = this.getTimer() - this._time,
                                this.onEnterFrame(),
                                this.fire("onPlay")
                            }
                            ,
                            Ae.prototype.reverse = function() {
                                this.state = 3,
                                this._time = this.duration - this._time,
                                this._startTime = this.getTimer() - this._time,
                                this.onEnterFrame(),
                                this.fire("onReverse")
                            }
                            ,
                            Ae.prototype.seek = function(t) {
                                this.pause(),
                                this._time = t,
                                this.update(),
                                this.fire("onSeek")
                            }
                            ,
                            Ae.prototype.reset = function() {
                                this.pause(),
                                this._time = 0,
                                this.update(),
                                this.fire("onReset")
                            }
                            ,
                            Ae.prototype.finish = function() {
                                this.pause(),
                                this._time = this.duration,
                                this.update(),
                                this.fire("onFinish")
                            }
                            ,
                            Ae.prototype.update = function() {
                                this.setPosition(this.getPosition(this._time))
                            }
                            ,
                            Ae.prototype.onEnterFrame = function() {
                                var t = this.getTimer() - this._startTime;
                                2 === this.state ? this.setTime(t) : 3 === this.state && this.setTime(this.duration - t)
                            }
                            ,
                            Ae.prototype.pause = function() {
                                this.state = 1,
                                this.fire("onPause")
                            }
                            ,
                            Ae.prototype.getTimer = function() {
                                return (new Date).getTime()
                            }
                            ,
                            Ae);
                            function Ae(t, e, i, n, r, o, a) {
                                this.prop = t,
                                this.propFunc = e,
                                this.begin = n,
                                this._pos = n,
                                this.duration = o,
                                this._change = 0,
                                this.prevPos = 0,
                                this.yoyo = a,
                                this._time = 0,
                                this._position = 0,
                                this._startTime = 0,
                                this._finish = 0,
                                this.func = i,
                                this._change = r - this.begin,
                                this.pause()
                            }
                            var Me = (Ge.prototype._addAttr = function(t, e) {
                                var i, n, r, o, a, s, h, l, c = this.node, d = c._id, p = Ge.tweens[d][t];
                                if (p && delete Ge.attrs[d][p][t],
                                i = c.getAttr(t),
                                A._isArray(e))
                                    if (n = [],
                                    o = Math.max(e.length, i.length),
                                    "points" === t && e.length !== i.length && (e.length > i.length ? (s = i,
                                    i = A._prepareArrayForTween(i, e, c.closed())) : (a = e,
                                    e = A._prepareArrayForTween(e, i, c.closed()))),
                                    0 === t.indexOf("fill"))
                                        for (r = 0; r < o; r++)
                                            r % 2 == 0 ? n.push(e[r] - i[r]) : (h = A.colorToRGBA(i[r]),
                                            l = A.colorToRGBA(e[r]),
                                            i[r] = h,
                                            n.push({
                                                r: l.r - h.r,
                                                g: l.g - h.g,
                                                b: l.b - h.b,
                                                a: l.a - h.a
                                            }));
                                    else
                                        for (r = 0; r < o; r++)
                                            n.push(e[r] - i[r]);
                                else
                                    n = -1 !== ke.indexOf(t) ? (i = A.colorToRGBA(i),
                                    {
                                        r: (l = A.colorToRGBA(e)).r - i.r,
                                        g: l.g - i.g,
                                        b: l.b - i.b,
                                        a: l.a - i.a
                                    }) : e - i;
                                Ge.attrs[d][this._id][t] = {
                                    start: i,
                                    diff: n,
                                    end: e,
                                    trueEnd: a,
                                    trueStart: s
                                },
                                Ge.tweens[d][t] = this._id
                            }
                            ,
                            Ge.prototype._tweenFunc = function(t) {
                                var e, i, n, r, o, a, s, h, l = this.node, c = Ge.attrs[l._id][this._id];
                                for (e in c) {
                                    if (n = (i = c[e]).start,
                                    r = i.diff,
                                    h = i.end,
                                    A._isArray(n))
                                        if (o = [],
                                        s = Math.max(n.length, h.length),
                                        0 === e.indexOf("fill"))
                                            for (a = 0; a < s; a++)
                                                a % 2 == 0 ? o.push((n[a] || 0) + r[a] * t) : o.push("rgba(" + Math.round(n[a].r + r[a].r * t) + "," + Math.round(n[a].g + r[a].g * t) + "," + Math.round(n[a].b + r[a].b * t) + "," + (n[a].a + r[a].a * t) + ")");
                                        else
                                            for (a = 0; a < s; a++)
                                                o.push((n[a] || 0) + r[a] * t);
                                    else
                                        o = -1 !== ke.indexOf(e) ? "rgba(" + Math.round(n.r + r.r * t) + "," + Math.round(n.g + r.g * t) + "," + Math.round(n.b + r.b * t) + "," + (n.a + r.a * t) + ")" : n + r * t;
                                    l.setAttr(e, o)
                                }
                            }
                            ,
                            Ge.prototype._addListeners = function() {
                                var i = this;
                                this.tween.onPlay = function() {
                                    i.anim.start()
                                }
                                ,
                                this.tween.onReverse = function() {
                                    i.anim.start()
                                }
                                ,
                                this.tween.onPause = function() {
                                    i.anim.stop()
                                }
                                ,
                                this.tween.onFinish = function() {
                                    var t = i.node
                                      , e = Ge.attrs[t._id][i._id];
                                    e.points && e.points.trueEnd && t.setAttr("points", e.points.trueEnd),
                                    i.onFinish && i.onFinish.call(i)
                                }
                                ,
                                this.tween.onReset = function() {
                                    var t = i.node
                                      , e = Ge.attrs[t._id][i._id];
                                    e.points && e.points.trueStart && t.points(e.points.trueStart),
                                    i.onReset && i.onReset()
                                }
                            }
                            ,
                            Ge.prototype.play = function() {
                                return this.tween.play(),
                                this
                            }
                            ,
                            Ge.prototype.reverse = function() {
                                return this.tween.reverse(),
                                this
                            }
                            ,
                            Ge.prototype.reset = function() {
                                return this.tween.reset(),
                                this
                            }
                            ,
                            Ge.prototype.seek = function(t) {
                                return this.tween.seek(1e3 * t),
                                this
                            }
                            ,
                            Ge.prototype.pause = function() {
                                return this.tween.pause(),
                                this
                            }
                            ,
                            Ge.prototype.finish = function() {
                                return this.tween.finish(),
                                this
                            }
                            ,
                            Ge.prototype.destroy = function() {
                                var t, e = this.node._id, i = this._id, n = Ge.tweens[e];
                                for (t in this.pause(),
                                n)
                                    delete Ge.tweens[e][t];
                                delete Ge.attrs[e][i]
                            }
                            ,
                            Ge.attrs = {},
                            Ge.tweens = {},
                            Ge);
                            function Ge(t) {
                                var e, i = this, n = t.node, r = n._id, o = t.easing || Ee.Linear, a = !!t.yoyo, s = void 0 === t.duration ? .3 : 0 === t.duration ? .001 : t.duration;
                                this.node = n,
                                this._id = Pe++;
                                var h = n.getLayer() || (n instanceof G.Stage ? n.getLayers() : null);
                                for (e in h || A.error("Tween constructor have `node` that is not in a layer. Please add node into layer first."),
                                this.anim = new Se(function() {
                                    i.tween.onEnterFrame()
                                }
                                ,h),
                                this.tween = new Te(e,function(t) {
                                    i._tweenFunc(t)
                                }
                                ,o,0,1,1e3 * s,a),
                                this._addListeners(),
                                Ge.attrs[r] || (Ge.attrs[r] = {}),
                                Ge.attrs[r][this._id] || (Ge.attrs[r][this._id] = {}),
                                Ge.tweens[r] || (Ge.tweens[r] = {}),
                                t)
                                    void 0 === Ce[e] && this._addAttr(e, t[e]);
                                this.reset(),
                                this.onFinish = t.onFinish,
                                this.onReset = t.onReset
                            }
                            ct.prototype.to = function(t) {
                                var e = t.onFinish;
                                t.node = this,
                                t.onFinish = function() {
                                    this.destroy(),
                                    e && e()
                                }
                                ,
                                new Me(t).play()
                            }
                            ;
                            var Re, Ee = {
                                BackEaseIn: function(t, e, i, n) {
                                    return i * (t /= n) * t * (2.70158 * t - 1.70158) + e
                                },
                                BackEaseOut: function(t, e, i, n) {
                                    return i * ((t = t / n - 1) * t * (2.70158 * t + 1.70158) + 1) + e
                                },
                                BackEaseInOut: function(t, e, i, n) {
                                    var r = 1.70158;
                                    return (t /= n / 2) < 1 ? i / 2 * (t * t * ((1 + (r *= 1.525)) * t - r)) + e : i / 2 * ((t -= 2) * t * ((1 + (r *= 1.525)) * t + r) + 2) + e
                                },
                                ElasticEaseIn: function(t, e, i, n, r, o) {
                                    var a = 0;
                                    return 0 === t ? e : 1 == (t /= n) ? e + i : (o = o || .3 * n,
                                    a = !r || r < Math.abs(i) ? (r = i,
                                    o / 4) : o / (2 * Math.PI) * Math.asin(i / r),
                                    -(r * Math.pow(2, 10 * --t) * Math.sin((t * n - a) * (2 * Math.PI) / o)) + e)
                                },
                                ElasticEaseOut: function(t, e, i, n, r, o) {
                                    var a = 0;
                                    return 0 === t ? e : 1 == (t /= n) ? e + i : (o = o || .3 * n,
                                    a = !r || r < Math.abs(i) ? (r = i,
                                    o / 4) : o / (2 * Math.PI) * Math.asin(i / r),
                                    r * Math.pow(2, -10 * t) * Math.sin((t * n - a) * (2 * Math.PI) / o) + i + e)
                                },
                                ElasticEaseInOut: function(t, e, i, n, r, o) {
                                    var a = 0;
                                    return 0 === t ? e : 2 == (t /= n / 2) ? e + i : (o = o || n * (.3 * 1.5),
                                    a = !r || r < Math.abs(i) ? (r = i,
                                    o / 4) : o / (2 * Math.PI) * Math.asin(i / r),
                                    t < 1 ? r * Math.pow(2, 10 * --t) * Math.sin((t * n - a) * (2 * Math.PI) / o) * -.5 + e : r * Math.pow(2, -10 * --t) * Math.sin((t * n - a) * (2 * Math.PI) / o) * .5 + i + e)
                                },
                                BounceEaseOut: function(t, e, i, n) {
                                    return (t /= n) < 1 / 2.75 ? i * (7.5625 * t * t) + e : t < 2 / 2.75 ? i * (7.5625 * (t -= 1.5 / 2.75) * t + .75) + e : t < 2.5 / 2.75 ? i * (7.5625 * (t -= 2.25 / 2.75) * t + .9375) + e : i * (7.5625 * (t -= 2.625 / 2.75) * t + .984375) + e
                                },
                                BounceEaseIn: function(t, e, i, n) {
                                    return i - Ee.BounceEaseOut(n - t, 0, i, n) + e
                                },
                                BounceEaseInOut: function(t, e, i, n) {
                                    return t < n / 2 ? .5 * Ee.BounceEaseIn(2 * t, 0, i, n) + e : .5 * Ee.BounceEaseOut(2 * t - n, 0, i, n) + .5 * i + e
                                },
                                EaseIn: function(t, e, i, n) {
                                    return i * (t /= n) * t + e
                                },
                                EaseOut: function(t, e, i, n) {
                                    return -i * (t /= n) * (t - 2) + e
                                },
                                EaseInOut: function(t, e, i, n) {
                                    return (t /= n / 2) < 1 ? i / 2 * t * t + e : -i / 2 * (--t * (t - 2) - 1) + e
                                },
                                StrongEaseIn: function(t, e, i, n) {
                                    return i * (t /= n) * t * t * t * t + e
                                },
                                StrongEaseOut: function(t, e, i, n) {
                                    return i * ((t = t / n - 1) * t * t * t * t + 1) + e
                                },
                                StrongEaseInOut: function(t, e, i, n) {
                                    return (t /= n / 2) < 1 ? i / 2 * t * t * t * t * t + e : i / 2 * ((t -= 2) * t * t * t * t + 2) + e
                                },
                                Linear: function(t, e, i, n) {
                                    return i * t / n + e
                                }
                            }, Ie = A._assign(G, {
                                Collection: o,
                                Util: A,
                                Transform: p,
                                Node: ct,
                                ids: Q,
                                names: J,
                                Container: ft,
                                Stage: Ut,
                                stages: Yt,
                                Layer: ue,
                                FastLayer: ve,
                                Group: _e,
                                DD: q,
                                Shape: he,
                                shapes: ee,
                                Animation: Se,
                                Tween: Me,
                                Easings: Ee,
                                Context: M,
                                Canvas: N
                            }), Le = (P(De, Re = he),
                            De.prototype._sceneFunc = function(t) {
                                var e = G.getAngle(this.angle())
                                  , i = this.clockwise();
                                t.beginPath(),
                                t.arc(0, 0, this.outerRadius(), 0, e, i),
                                t.arc(0, 0, this.innerRadius(), e, 0, !i),
                                t.closePath(),
                                t.fillStrokeShape(this)
                            }
                            ,
                            De.prototype.getWidth = function() {
                                return 2 * this.outerRadius()
                            }
                            ,
                            De.prototype.getHeight = function() {
                                return 2 * this.outerRadius()
                            }
                            ,
                            De.prototype.setWidth = function(t) {
                                this.outerRadius(t / 2)
                            }
                            ,
                            De.prototype.setHeight = function(t) {
                                this.outerRadius(t / 2)
                            }
                            ,
                            De);
                            function De() {
                                return null !== Re && Re.apply(this, arguments) || this
                            }
                            Le.prototype._centroid = !0,
                            Le.prototype.className = "Arc",
                            Le.prototype._attrsAffectingSize = ["innerRadius", "outerRadius"],
                            i(Le),
                            w.addGetterSetter(Le, "innerRadius", 0, y()),
                            w.addGetterSetter(Le, "outerRadius", 0, y()),
                            w.addGetterSetter(Le, "angle", 0, y()),
                            w.addGetterSetter(Le, "clockwise", !1, b()),
                            o.mapMethods(Le);
                            var Oe, Fe = (P(Be, Oe = he),
                            Be.prototype._sceneFunc = function(t) {
                                var e, i, n, r = this.points(), o = r.length, a = this.tension(), s = this.closed(), h = this.bezier();
                                if (o) {
                                    if (t.beginPath(),
                                    t.moveTo(r[0], r[1]),
                                    0 !== a && 4 < o) {
                                        for (i = (e = this.getTensionPoints()).length,
                                        n = s ? 0 : 4,
                                        s || t.quadraticCurveTo(e[0], e[1], e[2], e[3]); n < i - 2; )
                                            t.bezierCurveTo(e[n++], e[n++], e[n++], e[n++], e[n++], e[n++]);
                                        s || t.quadraticCurveTo(e[i - 2], e[i - 1], r[o - 2], r[o - 1])
                                    } else if (h)
                                        for (n = 2; n < o; )
                                            t.bezierCurveTo(r[n++], r[n++], r[n++], r[n++], r[n++], r[n++]);
                                    else
                                        for (n = 2; n < o; n += 2)
                                            t.lineTo(r[n], r[n + 1]);
                                    s ? (t.closePath(),
                                    t.fillStrokeShape(this)) : t.strokeShape(this)
                                }
                            }
                            ,
                            Be.prototype.getTensionPoints = function() {
                                return this._getCache("tensionPoints", this._getTensionPoints)
                            }
                            ,
                            Be.prototype._getTensionPoints = function() {
                                return this.closed() ? this._getTensionPointsClosed() : A._expandPoints(this.points(), this.tension())
                            }
                            ,
                            Be.prototype._getTensionPointsClosed = function() {
                                var t = this.points()
                                  , e = t.length
                                  , i = this.tension()
                                  , n = A._getControlPoints(t[e - 2], t[e - 1], t[0], t[1], t[2], t[3], i)
                                  , r = A._getControlPoints(t[e - 4], t[e - 3], t[e - 2], t[e - 1], t[0], t[1], i)
                                  , o = A._expandPoints(t, i);
                                return [n[2], n[3]].concat(o).concat([r[0], r[1], t[e - 2], t[e - 1], r[2], r[3], n[0], n[1], t[0], t[1]])
                            }
                            ,
                            Be.prototype.getWidth = function() {
                                return this.getSelfRect().width
                            }
                            ,
                            Be.prototype.getHeight = function() {
                                return this.getSelfRect().height
                            }
                            ,
                            Be.prototype.getSelfRect = function() {
                                var t = this.points();
                                if (t.length < 4)
                                    return {
                                        x: t[0] || 0,
                                        y: t[1] || 0,
                                        width: 0,
                                        height: 0
                                    };
                                for (var e, i, n = (t = 0 !== this.tension() ? function() {
                                    for (var t = 0, e = 0, i = arguments.length; e < i; e++)
                                        t += arguments[e].length;
                                    for (var n = Array(t), r = 0, e = 0; e < i; e++)
                                        for (var o = arguments[e], a = 0, s = o.length; a < s; a++,
                                        r++)
                                            n[r] = o[a];
                                    return n
                                }([t[0], t[1]], this._getTensionPoints(), [t[t.length - 2], t[t.length - 1]]) : this.points())[0], r = t[0], o = t[1], a = t[1], s = 0; s < t.length / 2; s++)
                                    e = t[2 * s],
                                    i = t[2 * s + 1],
                                    n = Math.min(n, e),
                                    r = Math.max(r, e),
                                    o = Math.min(o, i),
                                    a = Math.max(a, i);
                                return {
                                    x: n,
                                    y: o,
                                    width: r - n,
                                    height: a - o
                                }
                            }
                            ,
                            Be);
                            function Be(t) {
                                var e = Oe.call(this, t) || this;
                                return e.on("pointsChange.konva tensionChange.konva closedChange.konva bezierChange.konva", function() {
                                    this._clearCache("tensionPoints")
                                }),
                                e
                            }
                            Fe.prototype.className = "Line",
                            Fe.prototype._attrsAffectingSize = ["points", "bezier", "tension"],
                            i(Fe),
                            w.addGetterSetter(Fe, "closed", !1),
                            w.addGetterSetter(Fe, "bezier", !1),
                            w.addGetterSetter(Fe, "tension", 0, y()),
                            w.addGetterSetter(Fe, "points", [], function() {
                                if (G.isUnminified)
                                    return function(t, e) {
                                        return A._isArray(t) ? t.forEach(function(t) {
                                            A._isNumber(t) || A.warn('"' + e + '" attribute has non numeric element ' + t + ". Make sure that all elements are numbers.")
                                        }) : A.warn(g(t) + ' is a not valid value for "' + e + '" attribute. The value should be a array of numbers.'),
                                        t
                                    }
                            }()),
                            o.mapMethods(Fe);
                            var Ne, ze = (P(We, Ne = Fe),
                            We.prototype._sceneFunc = function(t) {
                                Ne.prototype._sceneFunc.call(this, t);
                                var e = 2 * Math.PI
                                  , i = this.points()
                                  , n = i
                                  , r = 0 !== this.tension() && 4 < i.length;
                                r && (n = this.getTensionPoints());
                                var o, a = i.length, s = r ? (o = i[a - 2] - (n[n.length - 2] + n[n.length - 4]) / 2,
                                i[a - 1] - (n[n.length - 1] + n[n.length - 3]) / 2) : (o = i[a - 2] - i[a - 4],
                                i[a - 1] - i[a - 3]), h = (Math.atan2(s, o) + e) % e, l = this.pointerLength(), c = this.pointerWidth();
                                t.save(),
                                t.beginPath(),
                                t.translate(i[a - 2], i[a - 1]),
                                t.rotate(h),
                                t.moveTo(0, 0),
                                t.lineTo(-l, c / 2),
                                t.lineTo(-l, -c / 2),
                                t.closePath(),
                                t.restore(),
                                this.pointerAtBeginning() && (t.save(),
                                t.translate(i[0], i[1]),
                                s = r ? (o = (n[0] + n[2]) / 2 - i[0],
                                (n[1] + n[3]) / 2 - i[1]) : (o = i[2] - i[0],
                                i[3] - i[1]),
                                t.rotate((Math.atan2(-s, -o) + e) % e),
                                t.moveTo(0, 0),
                                t.lineTo(-l, c / 2),
                                t.lineTo(-l, -c / 2),
                                t.closePath(),
                                t.restore());
                                var d = this.dashEnabled();
                                d && (this.attrs.dashEnabled = !1,
                                t.setLineDash([])),
                                t.fillStrokeShape(this),
                                d && (this.attrs.dashEnabled = !0)
                            }
                            ,
                            We.prototype.getSelfRect = function() {
                                var t = Ne.prototype.getSelfRect.call(this)
                                  , e = this.pointerWidth() / 2;
                                return {
                                    x: t.x - e,
                                    y: t.y - e,
                                    width: t.width + 2 * e,
                                    height: t.height + 2 * e
                                }
                            }
                            ,
                            We);
                            function We() {
                                return null !== Ne && Ne.apply(this, arguments) || this
                            }
                            ze.prototype.className = "Arrow",
                            i(ze),
                            w.addGetterSetter(ze, "pointerLength", 10, y()),
                            w.addGetterSetter(ze, "pointerWidth", 10, y()),
                            w.addGetterSetter(ze, "pointerAtBeginning", !1),
                            o.mapMethods(ze);
                            var He, Ye = (P(Xe, He = he),
                            Xe.prototype._sceneFunc = function(t) {
                                t.beginPath(),
                                t.arc(0, 0, this.radius(), 0, 2 * Math.PI, !1),
                                t.closePath(),
                                t.fillStrokeShape(this)
                            }
                            ,
                            Xe.prototype.getWidth = function() {
                                return 2 * this.radius()
                            }
                            ,
                            Xe.prototype.getHeight = function() {
                                return 2 * this.radius()
                            }
                            ,
                            Xe.prototype.setWidth = function(t) {
                                this.radius() !== t / 2 && this.radius(t / 2)
                            }
                            ,
                            Xe.prototype.setHeight = function(t) {
                                this.radius() !== t / 2 && this.radius(t / 2)
                            }
                            ,
                            Xe);
                            function Xe() {
                                return null !== He && He.apply(this, arguments) || this
                            }
                            Ye.prototype._centroid = !0,
                            Ye.prototype.className = "Circle",
                            Ye.prototype._attrsAffectingSize = ["radius"],
                            i(Ye),
                            w.addGetterSetter(Ye, "radius", 0, y()),
                            o.mapMethods(Ye);
                            var je, Ue = (P(qe, je = he),
                            qe.prototype._sceneFunc = function(t) {
                                var e = this.radiusX()
                                  , i = this.radiusY();
                                t.beginPath(),
                                t.save(),
                                e !== i && t.scale(1, i / e),
                                t.arc(0, 0, e, 0, 2 * Math.PI, !1),
                                t.restore(),
                                t.closePath(),
                                t.fillStrokeShape(this)
                            }
                            ,
                            qe.prototype.getWidth = function() {
                                return 2 * this.radiusX()
                            }
                            ,
                            qe.prototype.getHeight = function() {
                                return 2 * this.radiusY()
                            }
                            ,
                            qe.prototype.setWidth = function(t) {
                                this.radiusX(t / 2)
                            }
                            ,
                            qe.prototype.setHeight = function(t) {
                                this.radiusY(t / 2)
                            }
                            ,
                            qe);
                            function qe() {
                                return null !== je && je.apply(this, arguments) || this
                            }
                            Ue.prototype.className = "Ellipse",
                            Ue.prototype._centroid = !0,
                            Ue.prototype._attrsAffectingSize = ["radiusX", "radiusY"],
                            i(Ue),
                            w.addComponentsGetterSetter(Ue, "radius", ["x", "y"]),
                            w.addGetterSetter(Ue, "radiusX", 0, y()),
                            w.addGetterSetter(Ue, "radiusY", 0, y()),
                            o.mapMethods(Ue);
                            var Ke, Ve = (P(Qe, Ke = he),
                            Qe.prototype._useBufferCanvas = function() {
                                return Ke.prototype._useBufferCanvas.call(this, !0)
                            }
                            ,
                            Qe.prototype._sceneFunc = function(t) {
                                var e, i, n, r = this.getWidth(), o = this.getHeight(), a = this.attrs.image;
                                a && (e = this.attrs.cropWidth,
                                i = this.attrs.cropHeight,
                                n = e && i ? [a, this.cropX(), this.cropY(), e, i, 0, 0, r, o] : [a, 0, 0, r, o]),
                                (this.hasFill() || this.hasStroke()) && (t.beginPath(),
                                t.rect(0, 0, r, o),
                                t.closePath(),
                                t.fillStrokeShape(this)),
                                a && t.drawImage.apply(t, n)
                            }
                            ,
                            Qe.prototype._hitFunc = function(t) {
                                var e = this.width()
                                  , i = this.height();
                                t.beginPath(),
                                t.rect(0, 0, e, i),
                                t.closePath(),
                                t.fillStrokeShape(this)
                            }
                            ,
                            Qe.prototype.getWidth = function() {
                                var t, e;
                                return null !== (t = this.attrs.width) && void 0 !== t ? t : (null === (e = this.image()) || void 0 === e ? void 0 : e.width) || 0
                            }
                            ,
                            Qe.prototype.getHeight = function() {
                                var t, e;
                                return null !== (t = this.attrs.height) && void 0 !== t ? t : (null === (e = this.image()) || void 0 === e ? void 0 : e.height) || 0
                            }
                            ,
                            Qe.fromURL = function(t, e) {
                                var i = A.createImageElement();
                                i.onload = function() {
                                    var t = new Qe({
                                        image: i
                                    });
                                    e(t)
                                }
                                ,
                                i.crossOrigin = "Anonymous",
                                i.src = t
                            }
                            ,
                            Qe);
                            function Qe() {
                                return null !== Ke && Ke.apply(this, arguments) || this
                            }
                            Ve.prototype.className = "Image",
                            i(Ve),
                            w.addGetterSetter(Ve, "image"),
                            w.addComponentsGetterSetter(Ve, "crop", ["x", "y", "width", "height"]),
                            w.addGetterSetter(Ve, "cropX", 0, y()),
                            w.addGetterSetter(Ve, "cropY", 0, y()),
                            w.addGetterSetter(Ve, "cropWidth", 0, y()),
                            w.addGetterSetter(Ve, "cropHeight", 0, y()),
                            o.mapMethods(Ve);
                            var Je, Ze = ["fontFamily", "fontSize", "fontStyle", "padding", "lineHeight", "text", "width"], $e = "right", ti = "down", ei = "left", ii = Ze.length, ni = (P(ri, Je = _e),
                            ri.prototype.getText = function() {
                                return this.find("Text")[0]
                            }
                            ,
                            ri.prototype.getTag = function() {
                                return this.find("Tag")[0]
                            }
                            ,
                            ri.prototype._addListeners = function(t) {
                                for (var e = this, i = function() {
                                    e._sync()
                                }, n = 0; n < ii; n++)
                                    t.on(Ze[n] + "Change.konva", i)
                            }
                            ,
                            ri.prototype.getWidth = function() {
                                return this.getText().width()
                            }
                            ,
                            ri.prototype.getHeight = function() {
                                return this.getText().height()
                            }
                            ,
                            ri.prototype._sync = function() {
                                var t, e, i, n, r, o, a, s = this.getText(), h = this.getTag();
                                if (s && h) {
                                    switch (t = s.width(),
                                    e = s.height(),
                                    i = h.pointerDirection(),
                                    n = h.pointerWidth(),
                                    a = h.pointerHeight(),
                                    o = r = 0,
                                    i) {
                                    case "up":
                                        r = t / 2,
                                        o = -1 * a;
                                        break;
                                    case $e:
                                        r = t + n,
                                        o = e / 2;
                                        break;
                                    case ti:
                                        r = t / 2,
                                        o = e + a;
                                        break;
                                    case ei:
                                        r = -1 * n,
                                        o = e / 2
                                    }
                                    h.setAttrs({
                                        x: -1 * r,
                                        y: -1 * o,
                                        width: t,
                                        height: e
                                    }),
                                    s.setAttrs({
                                        x: -1 * r,
                                        y: -1 * o
                                    })
                                }
                            }
                            ,
                            ri);
                            function ri(t) {
                                var e = Je.call(this, t) || this;
                                return e.on("add.konva", function(t) {
                                    this._addListeners(t.child),
                                    this._sync()
                                }),
                                e
                            }
                            ni.prototype.className = "Label",
                            i(ni),
                            o.mapMethods(ni);
                            var oi, ai = (P(si, oi = he),
                            si.prototype._sceneFunc = function(t) {
                                var e = this.width()
                                  , i = this.height()
                                  , n = this.pointerDirection()
                                  , r = this.pointerWidth()
                                  , o = this.pointerHeight()
                                  , a = Math.min(this.cornerRadius(), e / 2, i / 2);
                                t.beginPath(),
                                a ? t.moveTo(a, 0) : t.moveTo(0, 0),
                                "up" === n && (t.lineTo((e - r) / 2, 0),
                                t.lineTo(e / 2, -1 * o),
                                t.lineTo((e + r) / 2, 0)),
                                a ? (t.lineTo(e - a, 0),
                                t.arc(e - a, a, a, 3 * Math.PI / 2, 0, !1)) : t.lineTo(e, 0),
                                n === $e && (t.lineTo(e, (i - o) / 2),
                                t.lineTo(e + r, i / 2),
                                t.lineTo(e, (i + o) / 2)),
                                a ? (t.lineTo(e, i - a),
                                t.arc(e - a, i - a, a, 0, Math.PI / 2, !1)) : t.lineTo(e, i),
                                n === ti && (t.lineTo((e + r) / 2, i),
                                t.lineTo(e / 2, i + o),
                                t.lineTo((e - r) / 2, i)),
                                a ? (t.lineTo(a, i),
                                t.arc(a, i - a, a, Math.PI / 2, Math.PI, !1)) : t.lineTo(0, i),
                                n === ei && (t.lineTo(0, (i + o) / 2),
                                t.lineTo(-1 * r, i / 2),
                                t.lineTo(0, (i - o) / 2)),
                                a && (t.lineTo(0, a),
                                t.arc(a, a, a, Math.PI, 3 * Math.PI / 2, !1)),
                                t.closePath(),
                                t.fillStrokeShape(this)
                            }
                            ,
                            si.prototype.getSelfRect = function() {
                                var t = 0
                                  , e = 0
                                  , i = this.pointerWidth()
                                  , n = this.pointerHeight()
                                  , r = this.pointerDirection()
                                  , o = this.width()
                                  , a = this.height();
                                return "up" === r ? (e -= n,
                                a += n) : r === ti ? a += n : r === ei ? (t -= 1.5 * i,
                                o += i) : r === $e && (o += 1.5 * i),
                                {
                                    x: t,
                                    y: e,
                                    width: o,
                                    height: a
                                }
                            }
                            ,
                            si);
                            function si() {
                                return null !== oi && oi.apply(this, arguments) || this
                            }
                            ai.prototype.className = "Tag",
                            i(ai),
                            w.addGetterSetter(ai, "pointerDirection", "none"),
                            w.addGetterSetter(ai, "pointerWidth", 0, y()),
                            w.addGetterSetter(ai, "pointerHeight", 0, y()),
                            w.addGetterSetter(ai, "cornerRadius", 0, y()),
                            o.mapMethods(ai);
                            var hi, li = (P(ci, hi = he),
                            ci.prototype._sceneFunc = function(t) {
                                var e = this.dataArray;
                                t.beginPath();
                                for (var i = !1, n = 0; n < e.length; n++) {
                                    var r = e[n].command
                                      , o = e[n].points;
                                    switch (r) {
                                    case "L":
                                        t.lineTo(o[0], o[1]);
                                        break;
                                    case "M":
                                        t.moveTo(o[0], o[1]);
                                        break;
                                    case "C":
                                        t.bezierCurveTo(o[0], o[1], o[2], o[3], o[4], o[5]);
                                        break;
                                    case "Q":
                                        t.quadraticCurveTo(o[0], o[1], o[2], o[3]);
                                        break;
                                    case "A":
                                        var a = o[0]
                                          , s = o[1]
                                          , h = o[2]
                                          , l = o[3]
                                          , c = o[4]
                                          , d = o[5]
                                          , p = o[6]
                                          , u = o[7]
                                          , f = l < h ? h : l
                                          , g = l < h ? 1 : h / l
                                          , v = l < h ? l / h : 1;
                                        t.translate(a, s),
                                        t.rotate(p),
                                        t.scale(g, v),
                                        t.arc(0, 0, f, c, c + d, 1 - u),
                                        t.scale(1 / g, 1 / v),
                                        t.rotate(-p),
                                        t.translate(-a, -s);
                                        break;
                                    case "z":
                                        i = !0,
                                        t.closePath()
                                    }
                                }
                                i || this.hasFill() ? t.fillStrokeShape(this) : t.strokeShape(this)
                            }
                            ,
                            ci.prototype.getSelfRect = function() {
                                var s = [];
                                this.dataArray.forEach(function(t) {
                                    if ("A" === t.command) {
                                        var e = t.points[4]
                                          , i = t.points[5]
                                          , n = t.points[4] + i
                                          , r = Math.PI / 180;
                                        if (Math.abs(e - n) < r && (r = Math.abs(e - n)),
                                        i < 0)
                                            for (var o = e - r; n < o; o -= r) {
                                                var a = ci.getPointOnEllipticalArc(t.points[0], t.points[1], t.points[2], t.points[3], o, 0);
                                                s.push(a.x, a.y)
                                            }
                                        else
                                            for (o = e + r; o < n; o += r)
                                                a = ci.getPointOnEllipticalArc(t.points[0], t.points[1], t.points[2], t.points[3], o, 0),
                                                s.push(a.x, a.y)
                                    } else if ("C" === t.command)
                                        for (o = 0; o <= 1; o += .01)
                                            a = ci.getPointOnCubicBezier(o, t.start.x, t.start.y, t.points[0], t.points[1], t.points[2], t.points[3], t.points[4], t.points[5]),
                                            s.push(a.x, a.y);
                                    else
                                        s = s.concat(t.points)
                                });
                                for (var t, e, i = s[0], n = s[0], r = s[1], o = s[1], a = 0; a < s.length / 2; a++)
                                    t = s[2 * a],
                                    e = s[2 * a + 1],
                                    isNaN(t) || (i = Math.min(i, t),
                                    n = Math.max(n, t)),
                                    isNaN(e) || (r = Math.min(r, e),
                                    o = Math.max(o, e));
                                return {
                                    x: Math.round(i),
                                    y: Math.round(r),
                                    width: Math.round(n - i),
                                    height: Math.round(o - r)
                                }
                            }
                            ,
                            ci.prototype.getLength = function() {
                                return this.pathLength
                            }
                            ,
                            ci.prototype.getPointAtLength = function(t) {
                                var e, i = 0, n = this.dataArray.length;
                                if (!n)
                                    return null;
                                for (; i < n && t > this.dataArray[i].pathLength; )
                                    t -= this.dataArray[i].pathLength,
                                    ++i;
                                if (i === n)
                                    return {
                                        x: (e = this.dataArray[i - 1].points.slice(-2))[0],
                                        y: e[1]
                                    };
                                if (t < .01)
                                    return {
                                        x: (e = this.dataArray[i].points.slice(0, 2))[0],
                                        y: e[1]
                                    };
                                var r = this.dataArray[i]
                                  , o = r.points;
                                switch (r.command) {
                                case "L":
                                    return ci.getPointOnLine(t, r.start.x, r.start.y, o[0], o[1]);
                                case "C":
                                    return ci.getPointOnCubicBezier(t / r.pathLength, r.start.x, r.start.y, o[0], o[1], o[2], o[3], o[4], o[5]);
                                case "Q":
                                    return ci.getPointOnQuadraticBezier(t / r.pathLength, r.start.x, r.start.y, o[0], o[1], o[2], o[3]);
                                case "A":
                                    var a = o[0]
                                      , s = o[1]
                                      , h = o[2]
                                      , l = o[3]
                                      , c = o[4]
                                      , d = o[5]
                                      , p = o[6];
                                    return c += d * t / r.pathLength,
                                    ci.getPointOnEllipticalArc(a, s, h, l, c, p)
                                }
                                return null
                            }
                            ,
                            ci.getLineLength = function(t, e, i, n) {
                                return Math.sqrt((i - t) * (i - t) + (n - e) * (n - e))
                            }
                            ,
                            ci.getPointOnLine = function(t, e, i, n, r, o, a) {
                                void 0 === o && (o = e),
                                void 0 === a && (a = i);
                                var s = (r - i) / (n - e + 1e-8)
                                  , h = Math.sqrt(t * t / (1 + s * s));
                                n < e && (h *= -1);
                                var l, c = s * h;
                                if (n === e)
                                    l = {
                                        x: o,
                                        y: a + c
                                    };
                                else if ((a - i) / (o - e + 1e-8) == s)
                                    l = {
                                        x: o + h,
                                        y: a + c
                                    };
                                else {
                                    var d = this.getLineLength(e, i, n, r);
                                    if (d < 1e-8)
                                        return;
                                    var p = (o - e) * (n - e) + (a - i) * (r - i)
                                      , u = e + (p /= d * d) * (n - e)
                                      , f = i + p * (r - i)
                                      , g = this.getLineLength(o, a, u, f)
                                      , v = Math.sqrt(t * t - g * g)
                                      , h = Math.sqrt(v * v / (1 + s * s));
                                    n < e && (h *= -1),
                                    l = {
                                        x: u + h,
                                        y: f + (c = s * h)
                                    }
                                }
                                return l
                            }
                            ,
                            ci.getPointOnCubicBezier = function(t, e, i, n, r, o, a, s, h) {
                                function l(t) {
                                    return t * t * t
                                }
                                function c(t) {
                                    return 3 * t * t * (1 - t)
                                }
                                function d(t) {
                                    return 3 * t * (1 - t) * (1 - t)
                                }
                                function p(t) {
                                    return (1 - t) * (1 - t) * (1 - t)
                                }
                                return {
                                    x: s * l(t) + o * c(t) + n * d(t) + e * p(t),
                                    y: h * l(t) + a * c(t) + r * d(t) + i * p(t)
                                }
                            }
                            ,
                            ci.getPointOnQuadraticBezier = function(t, e, i, n, r, o, a) {
                                function s(t) {
                                    return t * t
                                }
                                function h(t) {
                                    return 2 * t * (1 - t)
                                }
                                function l(t) {
                                    return (1 - t) * (1 - t)
                                }
                                return {
                                    x: o * s(t) + n * h(t) + e * l(t),
                                    y: a * s(t) + r * h(t) + i * l(t)
                                }
                            }
                            ,
                            ci.getPointOnEllipticalArc = function(t, e, i, n, r, o) {
                                var a = Math.cos(o)
                                  , s = Math.sin(o)
                                  , h = i * Math.cos(r)
                                  , l = n * Math.sin(r);
                                return {
                                    x: t + (h * a - l * s),
                                    y: e + (h * s + l * a)
                                }
                            }
                            ,
                            ci.parsePathData = function(t) {
                                if (!t)
                                    return [];
                                for (var e = ["m", "M", "l", "L", "v", "V", "h", "H", "z", "Z", "c", "C", "q", "Q", "t", "T", "s", "S", "a", "A"], i = (i = t).replace(new RegExp(" ","g"), ","), n = 0; n < e.length; n++)
                                    i = i.replace(new RegExp(e[n],"g"), "|" + e[n]);
                                for (var r, o = i.split("|"), a = [], s = [], h = 0, l = 0, c = /([-+]?((\d+\.\d+)|((\d+)|(\.\d+)))(?:e[-+]?\d+)?)/gi, n = 1; n < o.length; n++) {
                                    var d = (p = o[n]).charAt(0)
                                      , p = p.slice(1);
                                    for (s.length = 0; r = c.exec(p); )
                                        s.push(r[0]);
                                    for (var u = [], f = 0, g = s.length; f < g; f++) {
                                        var v = parseFloat(s[f]);
                                        isNaN(v) ? u.push(0) : u.push(v)
                                    }
                                    for (; 0 < u.length && !isNaN(u[0]); ) {
                                        var y, m, _, b, x, S, w, C, P, k, T = null, A = [], M = h, G = l;
                                        switch (d) {
                                        case "l":
                                            h += u.shift(),
                                            l += u.shift(),
                                            T = "L",
                                            A.push(h, l);
                                            break;
                                        case "L":
                                            h = u.shift(),
                                            l = u.shift(),
                                            A.push(h, l);
                                            break;
                                        case "m":
                                            var R = u.shift()
                                              , E = u.shift();
                                            if (h += R,
                                            l += E,
                                            T = "M",
                                            2 < a.length && "z" === a[a.length - 1].command)
                                                for (var I = a.length - 2; 0 <= I; I--)
                                                    if ("M" === a[I].command) {
                                                        h = a[I].points[0] + R,
                                                        l = a[I].points[1] + E;
                                                        break
                                                    }
                                            A.push(h, l),
                                            d = "l";
                                            break;
                                        case "M":
                                            h = u.shift(),
                                            l = u.shift(),
                                            T = "M",
                                            A.push(h, l),
                                            d = "L";
                                            break;
                                        case "h":
                                            h += u.shift(),
                                            T = "L",
                                            A.push(h, l);
                                            break;
                                        case "H":
                                            h = u.shift(),
                                            T = "L",
                                            A.push(h, l);
                                            break;
                                        case "v":
                                            l += u.shift(),
                                            T = "L",
                                            A.push(h, l);
                                            break;
                                        case "V":
                                            l = u.shift(),
                                            T = "L",
                                            A.push(h, l);
                                            break;
                                        case "C":
                                            A.push(u.shift(), u.shift(), u.shift(), u.shift()),
                                            h = u.shift(),
                                            l = u.shift(),
                                            A.push(h, l);
                                            break;
                                        case "c":
                                            A.push(h + u.shift(), l + u.shift(), h + u.shift(), l + u.shift()),
                                            h += u.shift(),
                                            l += u.shift(),
                                            T = "C",
                                            A.push(h, l);
                                            break;
                                        case "S":
                                            m = h,
                                            _ = l,
                                            "C" === (y = a[a.length - 1]).command && (m = h + (h - y.points[2]),
                                            _ = l + (l - y.points[3])),
                                            A.push(m, _, u.shift(), u.shift()),
                                            h = u.shift(),
                                            l = u.shift(),
                                            T = "C",
                                            A.push(h, l);
                                            break;
                                        case "s":
                                            m = h,
                                            _ = l,
                                            "C" === (y = a[a.length - 1]).command && (m = h + (h - y.points[2]),
                                            _ = l + (l - y.points[3])),
                                            A.push(m, _, h + u.shift(), l + u.shift()),
                                            h += u.shift(),
                                            l += u.shift(),
                                            T = "C",
                                            A.push(h, l);
                                            break;
                                        case "Q":
                                            A.push(u.shift(), u.shift()),
                                            h = u.shift(),
                                            l = u.shift(),
                                            A.push(h, l);
                                            break;
                                        case "q":
                                            A.push(h + u.shift(), l + u.shift()),
                                            h += u.shift(),
                                            l += u.shift(),
                                            T = "Q",
                                            A.push(h, l);
                                            break;
                                        case "T":
                                            m = h,
                                            _ = l,
                                            "Q" === (y = a[a.length - 1]).command && (m = h + (h - y.points[0]),
                                            _ = l + (l - y.points[1])),
                                            h = u.shift(),
                                            l = u.shift(),
                                            T = "Q",
                                            A.push(m, _, h, l);
                                            break;
                                        case "t":
                                            m = h,
                                            _ = l,
                                            "Q" === (y = a[a.length - 1]).command && (m = h + (h - y.points[0]),
                                            _ = l + (l - y.points[1])),
                                            h += u.shift(),
                                            l += u.shift(),
                                            T = "Q",
                                            A.push(m, _, h, l);
                                            break;
                                        case "A":
                                            b = u.shift(),
                                            x = u.shift(),
                                            S = u.shift(),
                                            w = u.shift(),
                                            C = u.shift(),
                                            P = h,
                                            k = l,
                                            h = u.shift(),
                                            l = u.shift(),
                                            T = "A",
                                            A = this.convertEndpointToCenterParameterization(P, k, h, l, w, C, b, x, S);
                                            break;
                                        case "a":
                                            b = u.shift(),
                                            x = u.shift(),
                                            S = u.shift(),
                                            w = u.shift(),
                                            C = u.shift(),
                                            P = h,
                                            k = l,
                                            h += u.shift(),
                                            l += u.shift(),
                                            T = "A",
                                            A = this.convertEndpointToCenterParameterization(P, k, h, l, w, C, b, x, S)
                                        }
                                        a.push({
                                            command: T || d,
                                            points: A,
                                            start: {
                                                x: M,
                                                y: G
                                            },
                                            pathLength: this.calcLength(M, G, T || d, A)
                                        })
                                    }
                                    "z" !== d && "Z" !== d || a.push({
                                        command: "z",
                                        points: [],
                                        start: void 0,
                                        pathLength: 0
                                    })
                                }
                                return a
                            }
                            ,
                            ci.calcLength = function(t, e, i, n) {
                                var r, o, a, s, h = ci;
                                switch (i) {
                                case "L":
                                    return h.getLineLength(t, e, n[0], n[1]);
                                case "C":
                                    for (r = 0,
                                    o = h.getPointOnCubicBezier(0, t, e, n[0], n[1], n[2], n[3], n[4], n[5]),
                                    s = .01; s <= 1; s += .01)
                                        a = h.getPointOnCubicBezier(s, t, e, n[0], n[1], n[2], n[3], n[4], n[5]),
                                        r += h.getLineLength(o.x, o.y, a.x, a.y),
                                        o = a;
                                    return r;
                                case "Q":
                                    for (r = 0,
                                    o = h.getPointOnQuadraticBezier(0, t, e, n[0], n[1], n[2], n[3]),
                                    s = .01; s <= 1; s += .01)
                                        a = h.getPointOnQuadraticBezier(s, t, e, n[0], n[1], n[2], n[3]),
                                        r += h.getLineLength(o.x, o.y, a.x, a.y),
                                        o = a;
                                    return r;
                                case "A":
                                    r = 0;
                                    var l = n[4]
                                      , c = n[5]
                                      , d = n[4] + c
                                      , p = Math.PI / 180;
                                    if (Math.abs(l - d) < p && (p = Math.abs(l - d)),
                                    o = h.getPointOnEllipticalArc(n[0], n[1], n[2], n[3], l, 0),
                                    c < 0)
                                        for (s = l - p; d < s; s -= p)
                                            a = h.getPointOnEllipticalArc(n[0], n[1], n[2], n[3], s, 0),
                                            r += h.getLineLength(o.x, o.y, a.x, a.y),
                                            o = a;
                                    else
                                        for (s = l + p; s < d; s += p)
                                            a = h.getPointOnEllipticalArc(n[0], n[1], n[2], n[3], s, 0),
                                            r += h.getLineLength(o.x, o.y, a.x, a.y),
                                            o = a;
                                    return a = h.getPointOnEllipticalArc(n[0], n[1], n[2], n[3], d, 0),
                                    r += h.getLineLength(o.x, o.y, a.x, a.y)
                                }
                                return 0
                            }
                            ,
                            ci.convertEndpointToCenterParameterization = function(t, e, i, n, r, o, a, s, h) {
                                var l = h * (Math.PI / 180)
                                  , c = Math.cos(l) * (t - i) / 2 + Math.sin(l) * (e - n) / 2
                                  , d = -1 * Math.sin(l) * (t - i) / 2 + Math.cos(l) * (e - n) / 2
                                  , p = c * c / (a * a) + d * d / (s * s);
                                1 < p && (a *= Math.sqrt(p),
                                s *= Math.sqrt(p));
                                var u = Math.sqrt((a * a * (s * s) - a * a * (d * d) - s * s * (c * c)) / (a * a * (d * d) + s * s * (c * c)));
                                function f(t) {
                                    return Math.sqrt(t[0] * t[0] + t[1] * t[1])
                                }
                                function g(t, e) {
                                    return (t[0] * e[0] + t[1] * e[1]) / (f(t) * f(e))
                                }
                                function v(t, e) {
                                    return (t[0] * e[1] < t[1] * e[0] ? -1 : 1) * Math.acos(g(t, e))
                                }
                                r === o && (u *= -1),
                                isNaN(u) && (u = 0);
                                var y = u * a * d / s
                                  , m = u * -s * c / a
                                  , _ = (t + i) / 2 + Math.cos(l) * y - Math.sin(l) * m
                                  , b = (e + n) / 2 + Math.sin(l) * y + Math.cos(l) * m
                                  , x = v([1, 0], [(c - y) / a, (d - m) / s])
                                  , S = [(c - y) / a, (d - m) / s]
                                  , w = [(-1 * c - y) / a, (-1 * d - m) / s]
                                  , C = v(S, w);
                                return g(S, w) <= -1 && (C = Math.PI),
                                1 <= g(S, w) && (C = 0),
                                0 === o && 0 < C && (C -= 2 * Math.PI),
                                1 === o && C < 0 && (C += 2 * Math.PI),
                                [_, b, a, s, x, C, l, o]
                            }
                            ,
                            ci);
                            function ci(t) {
                                var e = hi.call(this, t) || this;
                                e.dataArray = [],
                                e.pathLength = 0,
                                e.dataArray = ci.parsePathData(e.data());
                                for (var i = e.pathLength = 0; i < e.dataArray.length; ++i)
                                    e.pathLength += e.dataArray[i].pathLength;
                                return e.on("dataChange.konva", function() {
                                    this.dataArray = ci.parsePathData(this.data());
                                    for (var t = this.pathLength = 0; t < this.dataArray.length; ++t)
                                        this.pathLength += this.dataArray[t].pathLength
                                }),
                                e
                            }
                            li.prototype.className = "Path",
                            li.prototype._attrsAffectingSize = ["data"],
                            i(li),
                            w.addGetterSetter(li, "data"),
                            o.mapMethods(li);
                            var di, pi = (P(ui, di = he),
                            ui.prototype._sceneFunc = function(t) {
                                var e, i, n, r, o = this.cornerRadius(), a = this.width(), s = this.height();
                                t.beginPath(),
                                o ? (r = n = i = e = 0,
                                "number" == typeof o ? e = i = n = r = Math.min(o, a / 2, s / 2) : (e = Math.min(o[0], a / 2, s / 2),
                                i = Math.min(o[1], a / 2, s / 2),
                                r = Math.min(o[2], a / 2, s / 2),
                                n = Math.min(o[3], a / 2, s / 2)),
                                t.moveTo(e, 0),
                                t.lineTo(a - i, 0),
                                t.arc(a - i, i, i, 3 * Math.PI / 2, 0, !1),
                                t.lineTo(a, s - r),
                                t.arc(a - r, s - r, r, 0, Math.PI / 2, !1),
                                t.lineTo(n, s),
                                t.arc(n, s - n, n, Math.PI / 2, Math.PI, !1),
                                t.lineTo(0, e),
                                t.arc(e, e, e, Math.PI, 3 * Math.PI / 2, !1)) : t.rect(0, 0, a, s),
                                t.closePath(),
                                t.fillStrokeShape(this)
                            }
                            ,
                            ui);
                            function ui() {
                                return null !== di && di.apply(this, arguments) || this
                            }
                            pi.prototype.className = "Rect",
                            i(pi),
                            w.addGetterSetter(pi, "cornerRadius", 0),
                            o.mapMethods(pi);
                            var fi, gi = (P(vi, fi = he),
                            vi.prototype._sceneFunc = function(t) {
                                var e, i, n, r = this.sides(), o = this.radius();
                                for (t.beginPath(),
                                t.moveTo(0, 0 - o),
                                e = 1; e < r; e++)
                                    i = o * Math.sin(2 * e * Math.PI / r),
                                    n = -1 * o * Math.cos(2 * e * Math.PI / r),
                                    t.lineTo(i, n);
                                t.closePath(),
                                t.fillStrokeShape(this)
                            }
                            ,
                            vi.prototype.getWidth = function() {
                                return 2 * this.radius()
                            }
                            ,
                            vi.prototype.getHeight = function() {
                                return 2 * this.radius()
                            }
                            ,
                            vi.prototype.setWidth = function(t) {
                                this.radius(t / 2)
                            }
                            ,
                            vi.prototype.setHeight = function(t) {
                                this.radius(t / 2)
                            }
                            ,
                            vi);
                            function vi() {
                                return null !== fi && fi.apply(this, arguments) || this
                            }
                            gi.prototype.className = "RegularPolygon",
                            gi.prototype._centroid = !0,
                            gi.prototype._attrsAffectingSize = ["radius"],
                            i(gi),
                            w.addGetterSetter(gi, "radius", 0, y()),
                            w.addGetterSetter(gi, "sides", 0, y()),
                            o.mapMethods(gi);
                            var yi, mi = 2 * Math.PI, _i = (P(bi, yi = he),
                            bi.prototype._sceneFunc = function(t) {
                                t.beginPath(),
                                t.arc(0, 0, this.innerRadius(), 0, mi, !1),
                                t.moveTo(this.outerRadius(), 0),
                                t.arc(0, 0, this.outerRadius(), mi, 0, !0),
                                t.closePath(),
                                t.fillStrokeShape(this)
                            }
                            ,
                            bi.prototype.getWidth = function() {
                                return 2 * this.outerRadius()
                            }
                            ,
                            bi.prototype.getHeight = function() {
                                return 2 * this.outerRadius()
                            }
                            ,
                            bi.prototype.setWidth = function(t) {
                                this.outerRadius(t / 2)
                            }
                            ,
                            bi.prototype.setHeight = function(t) {
                                this.outerRadius(t / 2)
                            }
                            ,
                            bi);
                            function bi() {
                                return null !== yi && yi.apply(this, arguments) || this
                            }
                            _i.prototype.className = "Ring",
                            _i.prototype._centroid = !0,
                            _i.prototype._attrsAffectingSize = ["innerRadius", "outerRadius"],
                            i(_i),
                            w.addGetterSetter(_i, "innerRadius", 0, y()),
                            w.addGetterSetter(_i, "outerRadius", 0, y()),
                            o.mapMethods(_i);
                            var xi, Si = (P(wi, xi = he),
                            wi.prototype._sceneFunc = function(t) {
                                var e, i, n = this.animation(), r = this.frameIndex(), o = 4 * r, a = this.animations()[n], s = this.frameOffsets(), h = a[0 + o], l = a[1 + o], c = a[2 + o], d = a[3 + o], p = this.image();
                                (this.hasFill() || this.hasStroke()) && (t.beginPath(),
                                t.rect(0, 0, c, d),
                                t.closePath(),
                                t.fillStrokeShape(this)),
                                p && (s ? (e = s[n],
                                i = 2 * r,
                                t.drawImage(p, h, l, c, d, e[0 + i], e[1 + i], c, d)) : t.drawImage(p, h, l, c, d, 0, 0, c, d))
                            }
                            ,
                            wi.prototype._hitFunc = function(t) {
                                var e, i, n = this.animation(), r = this.frameIndex(), o = 4 * r, a = this.animations()[n], s = this.frameOffsets(), h = a[2 + o], l = a[3 + o];
                                t.beginPath(),
                                s ? (e = s[n],
                                i = 2 * r,
                                t.rect(e[0 + i], e[1 + i], h, l)) : t.rect(0, 0, h, l),
                                t.closePath(),
                                t.fillShape(this)
                            }
                            ,
                            wi.prototype._useBufferCanvas = function() {
                                return xi.prototype._useBufferCanvas.call(this, !0)
                            }
                            ,
                            wi.prototype._setInterval = function() {
                                var t = this;
                                this.interval = setInterval(function() {
                                    t._updateIndex()
                                }, 1e3 / this.frameRate())
                            }
                            ,
                            wi.prototype.start = function() {
                                var t;
                                this.isRunning() || (t = this.getLayer(),
                                this.anim.setLayers(t),
                                this._setInterval(),
                                this.anim.start())
                            }
                            ,
                            wi.prototype.stop = function() {
                                this.anim.stop(),
                                clearInterval(this.interval)
                            }
                            ,
                            wi.prototype.isRunning = function() {
                                return this.anim.isRunning()
                            }
                            ,
                            wi.prototype._updateIndex = function() {
                                var t = this.frameIndex()
                                  , e = this.animation();
                                t < this.animations()[e].length / 4 - 1 ? this.frameIndex(t + 1) : this.frameIndex(0)
                            }
                            ,
                            wi);
                            function wi(t) {
                                var e = xi.call(this, t) || this;
                                return e._updated = !0,
                                e.anim = new Se(function() {
                                    var t = e._updated;
                                    return e._updated = !1,
                                    t
                                }
                                ),
                                e.on("animationChange.konva", function() {
                                    this.frameIndex(0)
                                }),
                                e.on("frameIndexChange.konva", function() {
                                    this._updated = !0
                                }),
                                e.on("frameRateChange.konva", function() {
                                    this.anim.isRunning() && (clearInterval(this.interval),
                                    this._setInterval())
                                }),
                                e
                            }
                            Si.prototype.className = "Sprite",
                            i(Si),
                            w.addGetterSetter(Si, "animation"),
                            w.addGetterSetter(Si, "animations"),
                            w.addGetterSetter(Si, "frameOffsets"),
                            w.addGetterSetter(Si, "image"),
                            w.addGetterSetter(Si, "frameIndex", 0, y()),
                            w.addGetterSetter(Si, "frameRate", 17, y()),
                            w.backCompat(Si, {
                                index: "frameIndex",
                                getIndex: "getFrameIndex",
                                setIndex: "setFrameIndex"
                            }),
                            o.mapMethods(Si);
                            var Ci, Pi = (P(ki, Ci = he),
                            ki.prototype._sceneFunc = function(t) {
                                var e = this.innerRadius()
                                  , i = this.outerRadius()
                                  , n = this.numPoints();
                                t.beginPath(),
                                t.moveTo(0, 0 - i);
                                for (var r = 1; r < 2 * n; r++) {
                                    var o = r % 2 == 0 ? i : e
                                      , a = o * Math.sin(r * Math.PI / n)
                                      , s = -1 * o * Math.cos(r * Math.PI / n);
                                    t.lineTo(a, s)
                                }
                                t.closePath(),
                                t.fillStrokeShape(this)
                            }
                            ,
                            ki.prototype.getWidth = function() {
                                return 2 * this.outerRadius()
                            }
                            ,
                            ki.prototype.getHeight = function() {
                                return 2 * this.outerRadius()
                            }
                            ,
                            ki.prototype.setWidth = function(t) {
                                this.outerRadius(t / 2)
                            }
                            ,
                            ki.prototype.setHeight = function(t) {
                                this.outerRadius(t / 2)
                            }
                            ,
                            ki);
                            function ki() {
                                return null !== Ci && Ci.apply(this, arguments) || this
                            }
                            Pi.prototype.className = "Star",
                            Pi.prototype._centroid = !0,
                            Pi.prototype._attrsAffectingSize = ["innerRadius", "outerRadius"],
                            i(Pi),
                            w.addGetterSetter(Pi, "numPoints", 5, y()),
                            w.addGetterSetter(Pi, "innerRadius", 0, y()),
                            w.addGetterSetter(Pi, "outerRadius", 0, y()),
                            o.mapMethods(Pi);
                            var Ti, Ai = "auto", Mi = "justify", Gi = ["fontFamily", "fontSize", "fontStyle", "fontVariant", "padding", "align", "verticalAlign", "lineHeight", "text", "width", "height", "wrap", "ellipsis", "letterSpacing"], Ri = Gi.length;
                            function Ei() {
                                return Ti || (Ti = A.createCanvasElement().getContext("2d"))
                            }
                            var Ii, Li = (P(Di, Ii = he),
                            Di.prototype._sceneFunc = function(t) {
                                var e, i = this.padding(), n = this.fontSize(), r = this.lineHeight() * n, o = this.textArr, a = o.length, s = this.verticalAlign(), h = 0, l = this.align(), c = this.getWidth(), d = this.letterSpacing(), p = this.fill(), u = this.textDecoration(), f = -1 !== u.indexOf("underline"), g = -1 !== u.indexOf("line-through"), v = 0, v = r / 2, y = 0, m = 0;
                                for (t.setAttr("font", this._getContextFont()),
                                t.setAttr("textBaseline", "middle"),
                                t.setAttr("textAlign", "left"),
                                "middle" === s ? h = (this.getHeight() - a * r - 2 * i) / 2 : "bottom" === s && (h = this.getHeight() - a * r - 2 * i),
                                t.translate(i, h + i),
                                e = 0; e < a; e++) {
                                    var _, b, x, y = 0, m = 0, S = o[e], w = S.text, C = S.width, P = e !== a - 1;
                                    if (t.save(),
                                    "right" === l ? y += c - C - 2 * i : "center" === l && (y += (c - C - 2 * i) / 2),
                                    f && (t.save(),
                                    t.beginPath(),
                                    t.moveTo(y, v + m + Math.round(n / 2)),
                                    b = 0 == (_ = w.split(" ").length - 1),
                                    x = l === Mi && P && !b ? c - 2 * i : C,
                                    t.lineTo(y + Math.round(x), v + m + Math.round(n / 2)),
                                    t.lineWidth = n / 15,
                                    t.strokeStyle = p,
                                    t.stroke(),
                                    t.restore()),
                                    g && (t.save(),
                                    t.beginPath(),
                                    t.moveTo(y, v + m),
                                    b = 0 == (_ = w.split(" ").length - 1),
                                    x = l === Mi && P && !b ? c - 2 * i : C,
                                    t.lineTo(y + Math.round(x), v + m),
                                    t.lineWidth = n / 15,
                                    t.strokeStyle = p,
                                    t.stroke(),
                                    t.restore()),
                                    0 !== d || l === Mi) {
                                        _ = w.split(" ").length - 1;
                                        for (var k = 0; k < w.length; k++) {
                                            var T = w[k];
                                            " " === T && e !== a - 1 && l === Mi && (y += (c - 2 * i - C) / _),
                                            this._partialTextX = y,
                                            this._partialTextY = v + m,
                                            this._partialText = T,
                                            t.fillStrokeShape(this),
                                            y += this.measureSize(T).width + d
                                        }
                                    } else
                                        this._partialTextX = y,
                                        this._partialTextY = v + m,
                                        this._partialText = w,
                                        t.fillStrokeShape(this);
                                    t.restore(),
                                    1 < a && (v += r)
                                }
                            }
                            ,
                            Di.prototype._hitFunc = function(t) {
                                var e = this.getWidth()
                                  , i = this.getHeight();
                                t.beginPath(),
                                t.rect(0, 0, e, i),
                                t.closePath(),
                                t.fillStrokeShape(this)
                            }
                            ,
                            Di.prototype.setText = function(t) {
                                var e = A._isString(t) ? t : null == t ? "" : t + "";
                                return this._setAttr("text", e),
                                this
                            }
                            ,
                            Di.prototype.getWidth = function() {
                                return this.attrs.width === Ai || void 0 === this.attrs.width ? this.getTextWidth() + 2 * this.padding() : this.attrs.width
                            }
                            ,
                            Di.prototype.getHeight = function() {
                                return this.attrs.height === Ai || void 0 === this.attrs.height ? this.fontSize() * this.textArr.length * this.lineHeight() + 2 * this.padding() : this.attrs.height
                            }
                            ,
                            Di.prototype.getTextWidth = function() {
                                return this.textWidth
                            }
                            ,
                            Di.prototype.getTextHeight = function() {
                                return A.warn("text.getTextHeight() method is deprecated. Use text.height() - for full height and text.fontSize() - for one line height."),
                                this.textHeight
                            }
                            ,
                            Di.prototype.measureSize = function(t) {
                                var e, i = Ei(), n = this.fontSize();
                                return i.save(),
                                i.font = this._getContextFont(),
                                e = i.measureText(t),
                                i.restore(),
                                {
                                    width: e.width,
                                    height: n
                                }
                            }
                            ,
                            Di.prototype._getContextFont = function() {
                                return G.UA.isIE ? this.fontStyle() + " " + this.fontSize() + "px " + this.fontFamily() : this.fontStyle() + " " + this.fontVariant() + " " + this.fontSize() + "px " + this.fontFamily().split(",").map(function(t) {
                                    var e = 0 <= (t = t.trim()).indexOf(" ")
                                      , i = 0 <= t.indexOf('"') || 0 <= t.indexOf("'");
                                    return e && !i && (t = '"' + t + '"'),
                                    t
                                }).join(", ")
                            }
                            ,
                            Di.prototype._addTextLine = function(t) {
                                this.align() === Mi && (t = t.trim());
                                var e = this._getTextWidth(t);
                                return this.textArr.push({
                                    text: t,
                                    width: e
                                })
                            }
                            ,
                            Di.prototype._getTextWidth = function(t) {
                                var e = this.letterSpacing()
                                  , i = t.length;
                                return Ei().measureText(t).width + (i ? e * (i - 1) : 0)
                            }
                            ,
                            Di.prototype._setTextData = function() {
                                var t = this.text().split("\n")
                                  , e = +this.fontSize()
                                  , i = 0
                                  , n = this.lineHeight() * e
                                  , r = this.attrs.width
                                  , o = this.attrs.height
                                  , a = r !== Ai && void 0 !== r
                                  , s = o !== Ai && void 0 !== o
                                  , h = this.padding()
                                  , l = r - 2 * h
                                  , c = o - 2 * h
                                  , d = 0
                                  , p = this.wrap()
                                  , u = "none" !== p
                                  , f = "char" !== p && u
                                  , g = this.ellipsis() && !u;
                                this.textArr = [],
                                Ei().font = this._getContextFont();
                                for (var v = g ? this._getTextWidth("…") : 0, y = 0, m = t.length; y < m; ++y) {
                                    var _ = t[y]
                                      , b = this._getTextWidth(_);
                                    if (a && l < b)
                                        for (; 0 < _.length; ) {
                                            for (var x, S, w = 0, C = _.length, P = "", k = 0; w < C; ) {
                                                var T = w + C >>> 1
                                                  , A = _.slice(0, 1 + T)
                                                  , M = this._getTextWidth(A) + v;
                                                M <= l ? (w = 1 + T,
                                                P = A + (g ? "…" : ""),
                                                k = M) : C = T
                                            }
                                            if (!P)
                                                break;
                                            if (!f || 0 < (S = (" " === (x = _[P.length]) || "-" === x) && k <= l ? P.length : Math.max(P.lastIndexOf(" "), P.lastIndexOf("-")) + 1) && (w = S,
                                            P = P.slice(0, w),
                                            k = this._getTextWidth(P)),
                                            P = P.trimRight(),
                                            this._addTextLine(P),
                                            i = Math.max(i, k),
                                            d += n,
                                            !u || s && c < d + n)
                                                break;
                                            if (0 < (_ = (_ = _.slice(w)).trimLeft()).length && (b = this._getTextWidth(_)) <= l) {
                                                this._addTextLine(_),
                                                d += n,
                                                i = Math.max(i, b);
                                                break
                                            }
                                        }
                                    else
                                        this._addTextLine(_),
                                        d += n,
                                        i = Math.max(i, b);
                                    if (s && c < d + n)
                                        break
                                }
                                this.textHeight = e,
                                this.textWidth = i
                            }
                            ,
                            Di.prototype.getStrokeScaleEnabled = function() {
                                return !0
                            }
                            ,
                            Di);
                            function Di(t) {
                                var e, i = Ii.call(this, ((e = (e = t) || {}).fillLinearGradientColorStops || e.fillRadialGradientColorStops || e.fillPatternImage || (e.fill = e.fill || "black"),
                                e)) || this;
                                i._partialTextX = 0;
                                for (var n = i._partialTextY = 0; n < Ri; n++)
                                    i.on(Gi[n] + "Change.konva", i._setTextData);
                                return i._setTextData(),
                                i
                            }
                            Li.prototype._fillFunc = function(t) {
                                t.fillText(this._partialText, this._partialTextX, this._partialTextY)
                            }
                            ,
                            Li.prototype._strokeFunc = function(t) {
                                t.strokeText(this._partialText, this._partialTextX, this._partialTextY)
                            }
                            ,
                            Li.prototype.className = "Text",
                            Li.prototype._attrsAffectingSize = ["text", "fontSize", "padding", "wrap", "lineHeight"],
                            i(Li),
                            w.overWriteSetter(Li, "width", m()),
                            w.overWriteSetter(Li, "height", m()),
                            w.addGetterSetter(Li, "fontFamily", "Arial"),
                            w.addGetterSetter(Li, "fontSize", 12, y()),
                            w.addGetterSetter(Li, "fontStyle", "normal"),
                            w.addGetterSetter(Li, "fontVariant", "normal"),
                            w.addGetterSetter(Li, "padding", 0, y()),
                            w.addGetterSetter(Li, "align", "left"),
                            w.addGetterSetter(Li, "verticalAlign", "top"),
                            w.addGetterSetter(Li, "lineHeight", 1, y()),
                            w.addGetterSetter(Li, "wrap", "word"),
                            w.addGetterSetter(Li, "ellipsis", !1),
                            w.addGetterSetter(Li, "letterSpacing", 0, y()),
                            w.addGetterSetter(Li, "text", "", _()),
                            w.addGetterSetter(Li, "textDecoration", ""),
                            o.mapMethods(Li);
                            function Oi(t) {
                                t.fillText(this.partialText, 0, 0)
                            }
                            function Fi(t) {
                                t.strokeText(this.partialText, 0, 0)
                            }
                            var Bi, Ni = (P(zi, Bi = he),
                            zi.prototype._sceneFunc = function(t) {
                                t.setAttr("font", this._getContextFont()),
                                t.setAttr("textBaseline", this.textBaseline()),
                                t.setAttr("textAlign", "left"),
                                t.save();
                                var e = this.textDecoration()
                                  , i = this.fill()
                                  , n = this.fontSize()
                                  , r = this.glyphInfo;
                                "underline" === e && t.beginPath();
                                for (var o = 0; o < r.length; o++) {
                                    t.save();
                                    var a = r[o].p0;
                                    t.translate(a.x, a.y),
                                    t.rotate(r[o].rotation),
                                    this.partialText = r[o].text,
                                    t.fillStrokeShape(this),
                                    "underline" === e && (0 === o && t.moveTo(0, n / 2 + 1),
                                    t.lineTo(n, n / 2 + 1)),
                                    t.restore()
                                }
                                "underline" === e && (t.strokeStyle = i,
                                t.lineWidth = n / 20,
                                t.stroke()),
                                t.restore()
                            }
                            ,
                            zi.prototype._hitFunc = function(t) {
                                t.beginPath();
                                var e, i = this.glyphInfo;
                                1 <= i.length && (e = i[0].p0,
                                t.moveTo(e.x, e.y));
                                for (var n = 0; n < i.length; n++) {
                                    var r = i[n].p1;
                                    t.lineTo(r.x, r.y)
                                }
                                t.setAttr("lineWidth", this.fontSize()),
                                t.setAttr("strokeStyle", this.colorKey),
                                t.stroke()
                            }
                            ,
                            zi.prototype.getTextWidth = function() {
                                return this.textWidth
                            }
                            ,
                            zi.prototype.getTextHeight = function() {
                                return A.warn("text.getTextHeight() method is deprecated. Use text.height() - for full height and text.fontSize() - for one line height."),
                                this.textHeight
                            }
                            ,
                            zi.prototype.setText = function(t) {
                                return Li.prototype.setText.call(this, t)
                            }
                            ,
                            zi.prototype._getContextFont = function() {
                                return Li.prototype._getContextFont.call(this)
                            }
                            ,
                            zi.prototype._getTextSize = function(t) {
                                var e = this.dummyCanvas.getContext("2d");
                                e.save(),
                                e.font = this._getContextFont();
                                var i = e.measureText(t);
                                return e.restore(),
                                {
                                    width: i.width,
                                    height: parseInt(this.attrs.fontSize, 10)
                                }
                            }
                            ,
                            zi.prototype._setTextData = function() {
                                var l = this
                                  , t = this._getTextSize(this.attrs.text)
                                  , c = this.letterSpacing()
                                  , d = this.align()
                                  , e = this.kerningFunc();
                                this.textWidth = t.width,
                                this.textHeight = t.height;
                                var p = Math.max(this.textWidth + ((this.attrs.text || "").length - 1) * c, 0);
                                this.glyphInfo = [];
                                for (var u = 0, i = 0; i < l.dataArray.length; i++)
                                    0 < l.dataArray[i].pathLength && (u += l.dataArray[i].pathLength);
                                var n = 0;
                                "center" === d && (n = Math.max(0, u / 2 - p / 2)),
                                "right" === d && (n = Math.max(0, u - p));
                                for (var f, g, v, r = this.text().split(""), y = this.text().split(" ").length - 1, o = -1, m = 0, _ = function() {
                                    m = 0;
                                    for (var t = l.dataArray, e = o + 1; e < t.length; e++) {
                                        if (0 < t[e].pathLength)
                                            return t[o = e];
                                        "M" === t[e].command && (f = {
                                            x: t[e].points[0],
                                            y: t[e].points[1]
                                        })
                                    }
                                    return {}
                                }, a = function(t) {
                                    var e = l._getTextSize(t).width + c;
                                    " " === t && "justify" === d && (e += (u - p) / y);
                                    var i = 0
                                      , n = 0;
                                    for (g = void 0; .01 < Math.abs(e - i) / e && n < 25; ) {
                                        n++;
                                        for (var r = i; void 0 === v; )
                                            (v = _()) && r + v.pathLength < e && (r += v.pathLength,
                                            v = void 0);
                                        if (v = {} || void 0 === f)
                                            return;
                                        var o = !1;
                                        switch (v.command) {
                                        case "L":
                                            li.getLineLength(f.x, f.y, v.points[0], v.points[1]) > e ? g = li.getPointOnLine(e, f.x, f.y, v.points[0], v.points[1], f.x, f.y) : v = void 0;
                                            break;
                                        case "A":
                                            var a = v.points[4]
                                              , s = v.points[5]
                                              , h = v.points[4] + s;
                                            0 === m ? m = a + 1e-8 : i < e ? m += Math.PI / 180 * s / Math.abs(s) : m -= Math.PI / 360 * s / Math.abs(s),
                                            (s < 0 && m < h || 0 <= s && h < m) && (m = h,
                                            o = !0),
                                            g = li.getPointOnEllipticalArc(v.points[0], v.points[1], v.points[2], v.points[3], m, v.points[6]);
                                            break;
                                        case "C":
                                            0 === m ? m = e > v.pathLength ? 1e-8 : e / v.pathLength : i < e ? m += (e - i) / v.pathLength : m -= (i - e) / v.pathLength,
                                            1 < m && (m = 1,
                                            o = !0),
                                            g = li.getPointOnCubicBezier(m, v.start.x, v.start.y, v.points[0], v.points[1], v.points[2], v.points[3], v.points[4], v.points[5]);
                                            break;
                                        case "Q":
                                            0 === m ? m = e / v.pathLength : i < e ? m += (e - i) / v.pathLength : m -= (i - e) / v.pathLength,
                                            1 < m && (m = 1,
                                            o = !0),
                                            g = li.getPointOnQuadraticBezier(m, v.start.x, v.start.y, v.points[0], v.points[1], v.points[2], v.points[3])
                                        }
                                        void 0 !== g && (i = li.getLineLength(f.x, f.y, g.x, g.y)),
                                        o && (o = !1,
                                        v = void 0)
                                    }
                                }, s = n / (l._getTextSize("C").width + c) - 1, h = 0; h < s && (a("C"),
                                void 0 !== f && void 0 !== g); h++)
                                    f = g;
                                for (var b = 0; b < r.length && (a(r[b]),
                                void 0 !== f && void 0 !== g); b++) {
                                    var x = li.getLineLength(f.x, f.y, g.x, g.y)
                                      , S = 0;
                                    if (e)
                                        try {
                                            S = e(r[b - 1], r[b]) * this.fontSize()
                                        } catch (t) {
                                            S = 0
                                        }
                                    f.x += S,
                                    g.x += S,
                                    this.textWidth += S;
                                    var w = li.getPointOnLine(S + x / 2, f.x, f.y, g.x, g.y)
                                      , C = Math.atan2(g.y - f.y, g.x - f.x);
                                    this.glyphInfo.push({
                                        transposeX: w.x,
                                        transposeY: w.y,
                                        text: r[b],
                                        rotation: C,
                                        p0: f,
                                        p1: g
                                    }),
                                    f = g
                                }
                            }
                            ,
                            zi.prototype.getSelfRect = function() {
                                if (!this.glyphInfo.length)
                                    return {
                                        x: 0,
                                        y: 0,
                                        width: 0,
                                        height: 0
                                    };
                                var e = [];
                                this.glyphInfo.forEach(function(t) {
                                    e.push(t.p0.x),
                                    e.push(t.p0.y),
                                    e.push(t.p1.x),
                                    e.push(t.p1.y)
                                });
                                for (var t, i, n = e[0] || 0, r = e[0] || 0, o = e[1] || 0, a = e[1] || 0, s = 0; s < e.length / 2; s++)
                                    t = e[2 * s],
                                    i = e[2 * s + 1],
                                    n = Math.min(n, t),
                                    r = Math.max(r, t),
                                    o = Math.min(o, i),
                                    a = Math.max(a, i);
                                var h = this.fontSize();
                                return {
                                    x: n - h / 2,
                                    y: o - h / 2,
                                    width: r - n + h,
                                    height: a - o + h
                                }
                            }
                            ,
                            zi);
                            function zi(t) {
                                var e = Bi.call(this, t) || this;
                                return e.dummyCanvas = A.createCanvasElement(),
                                e.dataArray = [],
                                e.dataArray = li.parsePathData(e.attrs.data),
                                e.on("dataChange.konva", function() {
                                    this.dataArray = li.parsePathData(this.attrs.data),
                                    this._setTextData()
                                }),
                                e.on("textChange.konva alignChange.konva letterSpacingChange.konva kerningFuncChange.konva", e._setTextData),
                                t && t.getKerning && (A.warn('getKerning TextPath API is deprecated. Please use "kerningFunc" instead.'),
                                e.kerningFunc(t.getKerning)),
                                e._setTextData(),
                                e
                            }
                            Ni.prototype._fillFunc = Oi,
                            Ni.prototype._strokeFunc = Fi,
                            Ni.prototype._fillFuncHit = Oi,
                            Ni.prototype._strokeFuncHit = Fi,
                            Ni.prototype.className = "TextPath",
                            Ni.prototype._attrsAffectingSize = ["text", "fontSize", "data"],
                            i(Ni),
                            w.addGetterSetter(Ni, "data"),
                            w.addGetterSetter(Ni, "fontFamily", "Arial"),
                            w.addGetterSetter(Ni, "fontSize", 12, y()),
                            w.addGetterSetter(Ni, "fontStyle", "normal"),
                            w.addGetterSetter(Ni, "align", "left"),
                            w.addGetterSetter(Ni, "letterSpacing", 0, y()),
                            w.addGetterSetter(Ni, "textBaseline", "middle"),
                            w.addGetterSetter(Ni, "fontVariant", "normal"),
                            w.addGetterSetter(Ni, "text", ""),
                            w.addGetterSetter(Ni, "textDecoration", null),
                            w.addGetterSetter(Ni, "kerningFunc", null),
                            o.mapMethods(Ni);
                            var Wi = "tr-konva"
                              , Hi = ["resizeEnabledChange", "rotateAnchorOffsetChange", "rotateEnabledChange", "enabledAnchorsChange", "anchorSizeChange", "borderEnabledChange", "borderStrokeChange", "borderStrokeWidthChange", "borderDashChange", "anchorStrokeChange", "anchorStrokeWidthChange", "anchorFillChange", "anchorCornerRadiusChange", "ignoreStrokeChange"].map(function(t) {
                                return t + "." + Wi
                            }).join(" ")
                              , Yi = "nodesRect"
                              , Xi = ["widthChange", "heightChange", "scaleXChange", "scaleYChange", "skewXChange", "skewYChange", "rotationChange", "offsetXChange", "offsetYChange", "transformsEnabledChange", "strokeWidthChange"].map(function(t) {
                                return t + "." + Wi
                            }).join(" ")
                              , ji = {
                                "top-left": -45,
                                "top-center": 0,
                                "top-right": 45,
                                "middle-right": -90,
                                "middle-left": 90,
                                "bottom-left": -135,
                                "bottom-center": 180,
                                "bottom-right": 135
                            }
                              , Ui = "ontouchstart"in G._global;
                            var qi = ["top-left", "top-center", "top-right", "middle-right", "middle-left", "bottom-left", "bottom-center", "bottom-right"];
                            function Ki(t, e, i) {
                                var n = i.x + (t.x - i.x) * Math.cos(e) - (t.y - i.y) * Math.sin(e)
                                  , r = i.y + (t.x - i.x) * Math.sin(e) + (t.y - i.y) * Math.cos(e);
                                return k(k({}, t), {
                                    rotation: t.rotation + e,
                                    x: n,
                                    y: r
                                })
                            }
                            function Vi(t, e) {
                                var i;
                                return Ki(t, e, {
                                    x: (i = t).x + i.width / 2 * Math.cos(i.rotation) + i.height / 2 * Math.sin(-i.rotation),
                                    y: i.y + i.height / 2 * Math.cos(i.rotation) + i.width / 2 * Math.sin(i.rotation)
                                })
                            }
                            var Qi, Ji = (P(Zi, Qi = _e),
                            Zi.prototype.attachTo = function(t) {
                                return this.setNode(t),
                                this
                            }
                            ,
                            Zi.prototype.setNode = function(t) {
                                return A.warn("tr.setNode(shape), tr.node(shape) and tr.attachTo(shape) methods are deprecated. Please use tr.nodes(nodesArray) instead."),
                                this.setNodes([t])
                            }
                            ,
                            Zi.prototype.getNode = function() {
                                return this._nodes && this._nodes[0]
                            }
                            ,
                            Zi.prototype.setNodes = function(t) {
                                var n = this;
                                return void 0 === t && (t = []),
                                this._nodes && this._nodes.length && this.detach(),
                                1 === (this._nodes = t).length ? this.rotation(t[0].rotation()) : this.rotation(0),
                                this._nodes.forEach(function(t) {
                                    function e() {
                                        n._resetTransformCache(),
                                        n._transforming || n.update()
                                    }
                                    var i = t._attrsAffectingSize.map(function(t) {
                                        return t + "Change." + Wi
                                    }).join(" ");
                                    t.on(i, e),
                                    t.on(Xi, e),
                                    t.on("_clearTransformCache." + Wi, e),
                                    t.on("xChange." + Wi + " yChange." + Wi, e),
                                    n._proxyDrag(t)
                                }),
                                this._resetTransformCache(),
                                this.findOne(".top-left") && this.update(),
                                this
                            }
                            ,
                            Zi.prototype._proxyDrag = function(r) {
                                var o, a = this;
                                r.on("dragstart." + Wi, function(t) {
                                    o = r.getAbsolutePosition(),
                                    a.isDragging() || r === a.findOne(".back") || a.startDrag()
                                }),
                                r.on("dragmove." + Wi, function(t) {
                                    var e, i, n;
                                    o && (e = r.getAbsolutePosition(),
                                    i = e.x - o.x,
                                    n = e.y - o.y,
                                    a.nodes().forEach(function(t) {
                                        var e;
                                        t !== r && (t.isDragging() || (e = t.getAbsolutePosition(),
                                        t.setAbsolutePosition({
                                            x: e.x + i,
                                            y: e.y + n
                                        }),
                                        t.startDrag()))
                                    }),
                                    o = null)
                                })
                            }
                            ,
                            Zi.prototype.getNodes = function() {
                                return this._nodes
                            }
                            ,
                            Zi.prototype.getActiveAnchor = function() {
                                return this._movingAnchorName
                            }
                            ,
                            Zi.prototype.detach = function() {
                                this._nodes && this._nodes.forEach(function(t) {
                                    t.off("." + Wi)
                                }),
                                this._nodes = [],
                                this._resetTransformCache()
                            }
                            ,
                            Zi.prototype._resetTransformCache = function() {
                                this._clearCache(Yi),
                                this._clearCache("transform"),
                                this._clearSelfAndDescendantCache("absoluteTransform")
                            }
                            ,
                            Zi.prototype._getNodeRect = function() {
                                return this._getCache(Yi, this.__getNodeRect)
                            }
                            ,
                            Zi.prototype.__getNodeShape = function(t, e, i) {
                                void 0 === e && (e = this.rotation());
                                var n = t.getClientRect({
                                    skipTransform: !0,
                                    skipShadow: !0,
                                    skipStroke: this.ignoreStroke()
                                })
                                  , r = t.getAbsoluteScale(i)
                                  , o = t.getAbsolutePosition(i)
                                  , a = n.x * r.x - t.offsetX() * r.x
                                  , s = n.y * r.y - t.offsetY() * r.y
                                  , h = (G.getAngle(t.getAbsoluteRotation()) + 2 * Math.PI) % (2 * Math.PI);
                                return Ki({
                                    x: o.x + a * Math.cos(h) + s * Math.sin(-h),
                                    y: o.y + s * Math.cos(h) + a * Math.sin(h),
                                    width: n.width * r.x,
                                    height: n.height * r.y,
                                    rotation: h
                                }, -G.getAngle(e), {
                                    x: 0,
                                    y: 0
                                })
                            }
                            ,
                            Zi.prototype.__getNodeRect = function() {
                                var r = this;
                                if (!this.getNode())
                                    return {
                                        x: -1e8,
                                        y: -1e8,
                                        width: 0,
                                        height: 0,
                                        rotation: 0
                                    };
                                var o = [];
                                this.nodes().map(function(t) {
                                    var e = t.getClientRect({
                                        skipTransform: !0,
                                        skipShadow: !0,
                                        skipStroke: r.ignoreStroke()
                                    })
                                      , i = [{
                                        x: e.x,
                                        y: e.y
                                    }, {
                                        x: e.x + e.width,
                                        y: e.y
                                    }, {
                                        x: e.x + e.width,
                                        y: e.y + e.height
                                    }, {
                                        x: e.x,
                                        y: e.y + e.height
                                    }]
                                      , n = t.getAbsoluteTransform();
                                    i.forEach(function(t) {
                                        var e = n.point(t);
                                        o.push(e)
                                    })
                                });
                                var i, n, a, s, h = new p;
                                h.rotate(-G.getAngle(this.rotation())),
                                o.forEach(function(t) {
                                    var e = h.point(t);
                                    void 0 === i && (i = a = e.x,
                                    n = s = e.y),
                                    i = Math.min(i, e.x),
                                    n = Math.min(n, e.y),
                                    a = Math.max(a, e.x),
                                    s = Math.max(s, e.y)
                                }),
                                h.invert();
                                var t = h.point({
                                    x: i,
                                    y: n
                                });
                                return {
                                    x: t.x,
                                    y: t.y,
                                    width: a - i,
                                    height: s - n,
                                    rotation: G.getAngle(this.rotation())
                                }
                            }
                            ,
                            Zi.prototype.getX = function() {
                                return this._getNodeRect().x
                            }
                            ,
                            Zi.prototype.getY = function() {
                                return this._getNodeRect().y
                            }
                            ,
                            Zi.prototype.getWidth = function() {
                                return this._getNodeRect().width
                            }
                            ,
                            Zi.prototype.getHeight = function() {
                                return this._getNodeRect().height
                            }
                            ,
                            Zi.prototype._createElements = function() {
                                this._createBack(),
                                qi.forEach(function(t) {
                                    this._createAnchor(t)
                                }
                                .bind(this)),
                                this._createAnchor("rotater")
                            }
                            ,
                            Zi.prototype._createAnchor = function(i) {
                                var n = this
                                  , r = new pi({
                                    stroke: "rgb(0, 161, 255)",
                                    fill: "white",
                                    strokeWidth: 1,
                                    name: i + " _anchor",
                                    dragDistance: 0,
                                    draggable: !0,
                                    hitStrokeWidth: Ui ? 10 : "auto"
                                })
                                  , e = this;
                                r.on("mousedown touchstart", function(t) {
                                    e._handleMouseDown(t)
                                }),
                                r.on("dragstart", function(t) {
                                    r.stopDrag(),
                                    t.cancelBubble = !0
                                }),
                                r.on("dragend", function(t) {
                                    t.cancelBubble = !0
                                }),
                                r.on("mouseenter", function() {
                                    var t = G.getAngle(n.rotation())
                                      , e = function(t, e) {
                                        if ("rotater" === t)
                                            return "crosshair";
                                        e += A._degToRad(ji[t] || 0);
                                        var i = (A._radToDeg(e) % 360 + 360) % 360;
                                        return A._inRange(i, 337.5, 360) || A._inRange(i, 0, 22.5) ? "ns-resize" : A._inRange(i, 22.5, 67.5) ? "nesw-resize" : A._inRange(i, 67.5, 112.5) ? "ew-resize" : A._inRange(i, 112.5, 157.5) ? "nwse-resize" : A._inRange(i, 157.5, 202.5) ? "ns-resize" : A._inRange(i, 202.5, 247.5) ? "nesw-resize" : A._inRange(i, 247.5, 292.5) ? "ew-resize" : A._inRange(i, 292.5, 337.5) ? "nwse-resize" : (A.error("Transformer has unknown angle for cursor detection: " + i),
                                        "pointer")
                                    }(i, t);
                                    r.getStage().content.style.cursor = e,
                                    n._cursorChange = !0
                                }),
                                r.on("mouseout", function() {
                                    r.getStage().content.style.cursor = "",
                                    n._cursorChange = !1
                                }),
                                this.add(r)
                            }
                            ,
                            Zi.prototype._createBack = function() {
                                var n = this
                                  , t = new he({
                                    name: "back",
                                    width: 0,
                                    height: 0,
                                    draggable: !0,
                                    sceneFunc: function(t) {
                                        var e = this.getParent()
                                          , i = e.padding();
                                        t.beginPath(),
                                        t.rect(-i, -i, this.width() + 2 * i, this.height() + 2 * i),
                                        t.moveTo(this.width() / 2, -i),
                                        e.rotateEnabled() && t.lineTo(this.width() / 2, -e.rotateAnchorOffset() * A._sign(this.height()) - i),
                                        t.fillStrokeShape(this)
                                    },
                                    hitFunc: function(t, e) {
                                        var i;
                                        n.shouldOverdrawWholeArea() && (i = n.padding(),
                                        t.beginPath(),
                                        t.rect(-i, -i, e.width() + 2 * i, e.height() + 2 * i),
                                        t.fillStrokeShape(e))
                                    }
                                });
                                this.add(t),
                                this._proxyDrag(t)
                            }
                            ,
                            Zi.prototype._handleMouseDown = function(t) {
                                this._movingAnchorName = t.target.name().split(" ")[0];
                                var e = this._getNodeRect()
                                  , i = e.width
                                  , n = e.height
                                  , r = Math.sqrt(Math.pow(i, 2) + Math.pow(n, 2));
                                this.sin = Math.abs(n / r),
                                this.cos = Math.abs(i / r),
                                window.addEventListener("mousemove", this._handleMouseMove),
                                window.addEventListener("touchmove", this._handleMouseMove),
                                window.addEventListener("mouseup", this._handleMouseUp, !0),
                                window.addEventListener("touchend", this._handleMouseUp, !0),
                                this._transforming = !0;
                                var o = t.target.getAbsolutePosition()
                                  , a = t.target.getStage().getPointerPosition();
                                this._anchorDragOffset = {
                                    x: a.x - o.x,
                                    y: a.y - o.y
                                },
                                this._fire("transformstart", {
                                    evt: t,
                                    target: this.getNode()
                                }),
                                this.getNode()._fire("transformstart", {
                                    evt: t,
                                    target: this.getNode()
                                })
                            }
                            ,
                            Zi.prototype._handleMouseMove = function(t) {
                                var e = this.findOne("." + this._movingAnchorName)
                                  , i = e.getStage();
                                i.setPointersPositions(t);
                                var n = i.getPointerPosition()
                                  , r = {
                                    x: n.x - this._anchorDragOffset.x,
                                    y: n.y - this._anchorDragOffset.y
                                }
                                  , o = e.getAbsolutePosition();
                                e.setAbsolutePosition(r);
                                var a, s, h, l, c, d, p, u, f, g, v, y, m, _, b, x, S, w, C, P, k, T, A, M = e.getAbsolutePosition();
                                o.x === M.x && o.y === M.y || ("rotater" !== this._movingAnchorName ? (a = this.keepRatio() || t.shiftKey,
                                p = this.centeredScaling() || t.altKey,
                                "top-left" === this._movingAnchorName ? a && (l = p ? {
                                    x: this.width() / 2,
                                    y: this.height() / 2
                                } : {
                                    x: this.findOne(".bottom-right").x(),
                                    y: this.findOne(".bottom-right").y()
                                },
                                s = Math.sqrt(Math.pow(l.x - e.x(), 2) + Math.pow(l.y - e.y(), 2)),
                                c = this.findOne(".top-left").x() > l.x ? -1 : 1,
                                d = this.findOne(".top-left").y() > l.y ? -1 : 1,
                                w = s * this.cos * c,
                                C = s * this.sin * d,
                                this.findOne(".top-left").x(l.x - w),
                                this.findOne(".top-left").y(l.y - C)) : "top-center" === this._movingAnchorName ? this.findOne(".top-left").y(e.y()) : "top-right" === this._movingAnchorName ? (a && (l = p ? {
                                    x: this.width() / 2,
                                    y: this.height() / 2
                                } : {
                                    x: this.findOne(".bottom-left").x(),
                                    y: this.findOne(".bottom-left").y()
                                },
                                s = Math.sqrt(Math.pow(e.x() - l.x, 2) + Math.pow(l.y - e.y(), 2)),
                                c = this.findOne(".top-right").x() < l.x ? -1 : 1,
                                d = this.findOne(".top-right").y() > l.y ? -1 : 1,
                                w = s * this.cos * c,
                                C = s * this.sin * d,
                                this.findOne(".top-right").x(l.x + w),
                                this.findOne(".top-right").y(l.y - C)),
                                h = e.position(),
                                this.findOne(".top-left").y(h.y),
                                this.findOne(".bottom-right").x(h.x)) : "middle-left" === this._movingAnchorName ? this.findOne(".top-left").x(e.x()) : "middle-right" === this._movingAnchorName ? this.findOne(".bottom-right").x(e.x()) : "bottom-left" === this._movingAnchorName ? (a && (l = p ? {
                                    x: this.width() / 2,
                                    y: this.height() / 2
                                } : {
                                    x: this.findOne(".top-right").x(),
                                    y: this.findOne(".top-right").y()
                                },
                                s = Math.sqrt(Math.pow(l.x - e.x(), 2) + Math.pow(e.y() - l.y, 2)),
                                c = l.x < e.x() ? -1 : 1,
                                d = e.y() < l.y ? -1 : 1,
                                w = s * this.cos * c,
                                C = s * this.sin * d,
                                e.x(l.x - w),
                                e.y(l.y + C)),
                                h = e.position(),
                                this.findOne(".top-left").x(h.x),
                                this.findOne(".bottom-right").y(h.y)) : "bottom-center" === this._movingAnchorName ? this.findOne(".bottom-right").y(e.y()) : "bottom-right" === this._movingAnchorName ? a && (l = p ? {
                                    x: this.width() / 2,
                                    y: this.height() / 2
                                } : {
                                    x: this.findOne(".top-left").x(),
                                    y: this.findOne(".top-left").y()
                                },
                                s = Math.sqrt(Math.pow(e.x() - l.x, 2) + Math.pow(e.y() - l.y, 2)),
                                c = this.findOne(".bottom-right").x() < l.x ? -1 : 1,
                                d = this.findOne(".bottom-right").y() < l.y ? -1 : 1,
                                w = s * this.cos * c,
                                C = s * this.sin * d,
                                this.findOne(".bottom-right").x(l.x + w),
                                this.findOne(".bottom-right").y(l.y + C)) : console.error(new Error("Wrong position argument of selection resizer: " + this._movingAnchorName)),
                                (p = this.centeredScaling() || t.altKey) && (u = this.findOne(".top-left"),
                                f = this.findOne(".bottom-right"),
                                g = u.x(),
                                v = u.y(),
                                y = this.getWidth() - f.x(),
                                m = this.getHeight() - f.y(),
                                f.move({
                                    x: -g,
                                    y: -v
                                }),
                                u.move({
                                    x: y,
                                    y: m
                                })),
                                w = (_ = this.findOne(".top-left").getAbsolutePosition()).x,
                                C = _.y,
                                b = this.findOne(".bottom-right").x() - this.findOne(".top-left").x(),
                                x = this.findOne(".bottom-right").y() - this.findOne(".top-left").y(),
                                this._fitNodesInto({
                                    x: w,
                                    y: C,
                                    width: b,
                                    height: x,
                                    rotation: G.getAngle(this.rotation())
                                }, t)) : (S = this._getNodeRect(),
                                w = e.x() - S.width / 2,
                                C = -e.y() + S.height / 2,
                                P = Math.atan2(-C, w) + Math.PI / 2,
                                S.height < 0 && (P -= Math.PI),
                                k = G.getAngle(this.rotation()) + P,
                                T = G.getAngle(this.rotationSnapTolerance()),
                                A = Vi(S, function(t, e, i) {
                                    for (var n = e, r = 0; r < t.length; r++) {
                                        var o = G.getAngle(t[r])
                                          , a = Math.abs(o - e) % (2 * Math.PI);
                                        Math.min(a, 2 * Math.PI - a) < i && (n = o)
                                    }
                                    return n
                                }(this.rotationSnaps(), k, T) - S.rotation),
                                this._fitNodesInto(A, t)))
                            }
                            ,
                            Zi.prototype._handleMouseUp = function(t) {
                                this._removeEvents(t)
                            }
                            ,
                            Zi.prototype.getAbsoluteTransform = function() {
                                return this.getTransform()
                            }
                            ,
                            Zi.prototype._removeEvents = function(t) {
                                var e;
                                this._transforming && (this._transforming = !1,
                                window.removeEventListener("mousemove", this._handleMouseMove),
                                window.removeEventListener("touchmove", this._handleMouseMove),
                                window.removeEventListener("mouseup", this._handleMouseUp, !0),
                                window.removeEventListener("touchend", this._handleMouseUp, !0),
                                e = this.getNode(),
                                this._fire("transformend", {
                                    evt: t,
                                    target: e
                                }),
                                e && e.fire("transformend", {
                                    evt: t,
                                    target: e
                                }),
                                this._movingAnchorName = null)
                            }
                            ,
                            Zi.prototype._fitNodesInto = function(t, o) {
                                var e, i, n, r, a, s, h = this, l = this._getNodeRect();
                                A._inRange(t.width, 2 * -this.padding() - 1, 1) || A._inRange(t.height, 2 * -this.padding() - 1, 1) ? this.update() : ((e = new p).rotate(G.getAngle(this.rotation())),
                                this._movingAnchorName && t.width < 0 && 0 <= this._movingAnchorName.indexOf("left") ? (i = e.point({
                                    x: 2 * -this.padding(),
                                    y: 0
                                }),
                                t.x += i.x,
                                t.y += i.y,
                                t.width += 2 * this.padding(),
                                this._movingAnchorName = this._movingAnchorName.replace("left", "right"),
                                this._anchorDragOffset.x -= i.x,
                                this._anchorDragOffset.y -= i.y) : this._movingAnchorName && t.width < 0 && 0 <= this._movingAnchorName.indexOf("right") && (i = e.point({
                                    x: 2 * this.padding(),
                                    y: 0
                                }),
                                this._movingAnchorName = this._movingAnchorName.replace("right", "left"),
                                this._anchorDragOffset.x -= i.x,
                                this._anchorDragOffset.y -= i.y,
                                t.width += 2 * this.padding()),
                                this._movingAnchorName && t.height < 0 && 0 <= this._movingAnchorName.indexOf("top") ? (i = e.point({
                                    x: 0,
                                    y: 2 * -this.padding()
                                }),
                                t.x += i.x,
                                t.y += i.y,
                                this._movingAnchorName = this._movingAnchorName.replace("top", "bottom"),
                                this._anchorDragOffset.x -= i.x,
                                this._anchorDragOffset.y -= i.y,
                                t.height += 2 * this.padding()) : this._movingAnchorName && t.height < 0 && 0 <= this._movingAnchorName.indexOf("bottom") && (i = e.point({
                                    x: 0,
                                    y: 2 * this.padding()
                                }),
                                this._movingAnchorName = this._movingAnchorName.replace("bottom", "top"),
                                this._anchorDragOffset.x -= i.x,
                                this._anchorDragOffset.y -= i.y,
                                t.height += 2 * this.padding()),
                                this.boundBoxFunc() && ((n = this.boundBoxFunc()(l, t)) ? t = n : A.warn("boundBoxFunc returned falsy. You should return new bound rect from it!")),
                                (r = new p).translate(l.x, l.y),
                                r.rotate(l.rotation),
                                r.scale(l.width / 1e7, l.height / 1e7),
                                (a = new p).translate(t.x, t.y),
                                a.rotate(t.rotation),
                                a.scale(t.width / 1e7, t.height / 1e7),
                                s = a.multiply(r.invert()),
                                this._nodes.forEach(function(t) {
                                    var e = t.getParent().getAbsoluteTransform()
                                      , i = t.getTransform().copy();
                                    i.translate(t.offsetX(), t.offsetY());
                                    var n = new p;
                                    n.multiply(e.copy().invert()).multiply(s).multiply(e).multiply(i);
                                    var r = n.decompose();
                                    t.setAttrs(r),
                                    h._fire("transform", {
                                        evt: o,
                                        target: t
                                    }),
                                    t._fire("transform", {
                                        evt: o,
                                        target: t
                                    })
                                }),
                                this.rotation(A._getRotation(t.rotation)),
                                this._resetTransformCache(),
                                this.update(),
                                this.getLayer().batchDraw())
                            }
                            ,
                            Zi.prototype.forceUpdate = function() {
                                this._resetTransformCache(),
                                this.update()
                            }
                            ,
                            Zi.prototype._batchChangeChild = function(t, e) {
                                this.findOne(t).setAttrs(e)
                            }
                            ,
                            Zi.prototype.update = function() {
                                var e = this
                                  , t = this._getNodeRect();
                                this.rotation(A._getRotation(t.rotation));
                                var i = t.width
                                  , n = t.height
                                  , r = this.enabledAnchors()
                                  , o = this.resizeEnabled()
                                  , a = this.padding()
                                  , s = this.anchorSize();
                                this.find("._anchor").each(function(t) {
                                    t.setAttrs({
                                        width: s,
                                        height: s,
                                        offsetX: s / 2,
                                        offsetY: s / 2,
                                        stroke: e.anchorStroke(),
                                        strokeWidth: e.anchorStrokeWidth(),
                                        fill: e.anchorFill(),
                                        cornerRadius: e.anchorCornerRadius()
                                    })
                                }),
                                this._batchChangeChild(".top-left", {
                                    x: 0,
                                    y: 0,
                                    offsetX: s / 2 + a,
                                    offsetY: s / 2 + a,
                                    visible: o && 0 <= r.indexOf("top-left")
                                }),
                                this._batchChangeChild(".top-center", {
                                    x: i / 2,
                                    y: 0,
                                    offsetY: s / 2 + a,
                                    visible: o && 0 <= r.indexOf("top-center")
                                }),
                                this._batchChangeChild(".top-right", {
                                    x: i,
                                    y: 0,
                                    offsetX: s / 2 - a,
                                    offsetY: s / 2 + a,
                                    visible: o && 0 <= r.indexOf("top-right")
                                }),
                                this._batchChangeChild(".middle-left", {
                                    x: 0,
                                    y: n / 2,
                                    offsetX: s / 2 + a,
                                    visible: o && 0 <= r.indexOf("middle-left")
                                }),
                                this._batchChangeChild(".middle-right", {
                                    x: i,
                                    y: n / 2,
                                    offsetX: s / 2 - a,
                                    visible: o && 0 <= r.indexOf("middle-right")
                                }),
                                this._batchChangeChild(".bottom-left", {
                                    x: 0,
                                    y: n,
                                    offsetX: s / 2 + a,
                                    offsetY: s / 2 - a,
                                    visible: o && 0 <= r.indexOf("bottom-left")
                                }),
                                this._batchChangeChild(".bottom-center", {
                                    x: i / 2,
                                    y: n,
                                    offsetY: s / 2 - a,
                                    visible: o && 0 <= r.indexOf("bottom-center")
                                }),
                                this._batchChangeChild(".bottom-right", {
                                    x: i,
                                    y: n,
                                    offsetX: s / 2 - a,
                                    offsetY: s / 2 - a,
                                    visible: o && 0 <= r.indexOf("bottom-right")
                                }),
                                this._batchChangeChild(".rotater", {
                                    x: i / 2,
                                    y: -this.rotateAnchorOffset() * A._sign(n) - a,
                                    visible: this.rotateEnabled()
                                }),
                                this._batchChangeChild(".back", {
                                    width: i,
                                    height: n,
                                    visible: this.borderEnabled(),
                                    stroke: this.borderStroke(),
                                    strokeWidth: this.borderStrokeWidth(),
                                    dash: this.borderDash(),
                                    x: 0,
                                    y: 0
                                })
                            }
                            ,
                            Zi.prototype.isTransforming = function() {
                                return this._transforming
                            }
                            ,
                            Zi.prototype.stopTransform = function() {
                                var t;
                                this._transforming && (this._removeEvents(),
                                (t = this.findOne("." + this._movingAnchorName)) && t.stopDrag())
                            }
                            ,
                            Zi.prototype.destroy = function() {
                                return this.getStage() && this._cursorChange && (this.getStage().content.style.cursor = ""),
                                _e.prototype.destroy.call(this),
                                this.detach(),
                                this._removeEvents(),
                                this
                            }
                            ,
                            Zi.prototype.toObject = function() {
                                return ct.prototype.toObject.call(this)
                            }
                            ,
                            Zi);
                            function Zi(t) {
                                var e = Qi.call(this, t) || this;
                                return e._transforming = !1,
                                e._createElements(),
                                e._handleMouseMove = e._handleMouseMove.bind(e),
                                e._handleMouseUp = e._handleMouseUp.bind(e),
                                e.update = e.update.bind(e),
                                e.on(Hi, e.update),
                                e.getNode() && e.update(),
                                e
                            }
                            Ji.prototype.className = "Transformer",
                            i(Ji),
                            w.addGetterSetter(Ji, "enabledAnchors", qi, function(t) {
                                return t instanceof Array || A.warn("enabledAnchors value should be an array"),
                                t instanceof Array && t.forEach(function(t) {
                                    -1 === qi.indexOf(t) && A.warn("Unknown anchor name: " + t + ". Available names are: " + qi.join(", "))
                                }),
                                t || []
                            }),
                            w.addGetterSetter(Ji, "resizeEnabled", !0),
                            w.addGetterSetter(Ji, "anchorSize", 10, y()),
                            w.addGetterSetter(Ji, "rotateEnabled", !0),
                            w.addGetterSetter(Ji, "rotationSnaps", []),
                            w.addGetterSetter(Ji, "rotateAnchorOffset", 50, y()),
                            w.addGetterSetter(Ji, "rotationSnapTolerance", 5, y()),
                            w.addGetterSetter(Ji, "borderEnabled", !0),
                            w.addGetterSetter(Ji, "anchorStroke", "rgb(0, 161, 255)"),
                            w.addGetterSetter(Ji, "anchorStrokeWidth", 1, y()),
                            w.addGetterSetter(Ji, "anchorFill", "white"),
                            w.addGetterSetter(Ji, "anchorCornerRadius", 0, y()),
                            w.addGetterSetter(Ji, "borderStroke", "rgb(0, 161, 255)"),
                            w.addGetterSetter(Ji, "borderStrokeWidth", 1, y()),
                            w.addGetterSetter(Ji, "borderDash"),
                            w.addGetterSetter(Ji, "keepRatio", !0),
                            w.addGetterSetter(Ji, "centeredScaling", !1),
                            w.addGetterSetter(Ji, "ignoreStroke", !1),
                            w.addGetterSetter(Ji, "padding", 0, y()),
                            w.addGetterSetter(Ji, "node"),
                            w.addGetterSetter(Ji, "nodes"),
                            w.addGetterSetter(Ji, "boundBoxFunc"),
                            w.addGetterSetter(Ji, "shouldOverdrawWholeArea", !1),
                            w.backCompat(Ji, {
                                lineEnabled: "borderEnabled",
                                rotateHandlerOffset: "rotateAnchorOffset",
                                enabledHandlers: "enabledAnchors"
                            }),
                            o.mapMethods(Ji);
                            var $i, tn = (P(en, $i = he),
                            en.prototype._sceneFunc = function(t) {
                                t.beginPath(),
                                t.arc(0, 0, this.radius(), 0, G.getAngle(this.angle()), this.clockwise()),
                                t.lineTo(0, 0),
                                t.closePath(),
                                t.fillStrokeShape(this)
                            }
                            ,
                            en.prototype.getWidth = function() {
                                return 2 * this.radius()
                            }
                            ,
                            en.prototype.getHeight = function() {
                                return 2 * this.radius()
                            }
                            ,
                            en.prototype.setWidth = function(t) {
                                this.radius(t / 2)
                            }
                            ,
                            en.prototype.setHeight = function(t) {
                                this.radius(t / 2)
                            }
                            ,
                            en);
                            function en() {
                                return null !== $i && $i.apply(this, arguments) || this
                            }
                            function nn() {
                                this.r = 0,
                                this.g = 0,
                                this.b = 0,
                                this.a = 0,
                                this.next = null
                            }
                            tn.prototype.className = "Wedge",
                            tn.prototype._centroid = !0,
                            tn.prototype._attrsAffectingSize = ["radius"],
                            i(tn),
                            w.addGetterSetter(tn, "radius", 0, y()),
                            w.addGetterSetter(tn, "angle", 0, y()),
                            w.addGetterSetter(tn, "clockwise", !1),
                            w.backCompat(tn, {
                                angleDeg: "angle",
                                getAngleDeg: "getAngle",
                                setAngleDeg: "setAngle"
                            }),
                            o.mapMethods(tn);
                            var rn = [512, 512, 456, 512, 328, 456, 335, 512, 405, 328, 271, 456, 388, 335, 292, 512, 454, 405, 364, 328, 298, 271, 496, 456, 420, 388, 360, 335, 312, 292, 273, 512, 482, 454, 428, 405, 383, 364, 345, 328, 312, 298, 284, 271, 259, 496, 475, 456, 437, 420, 404, 388, 374, 360, 347, 335, 323, 312, 302, 292, 282, 273, 265, 512, 497, 482, 468, 454, 441, 428, 417, 405, 394, 383, 373, 364, 354, 345, 337, 328, 320, 312, 305, 298, 291, 284, 278, 271, 265, 259, 507, 496, 485, 475, 465, 456, 446, 437, 428, 420, 412, 404, 396, 388, 381, 374, 367, 360, 354, 347, 341, 335, 329, 323, 318, 312, 307, 302, 297, 292, 287, 282, 278, 273, 269, 265, 261, 512, 505, 497, 489, 482, 475, 468, 461, 454, 447, 441, 435, 428, 422, 417, 411, 405, 399, 394, 389, 383, 378, 373, 368, 364, 359, 354, 350, 345, 341, 337, 332, 328, 324, 320, 316, 312, 309, 305, 301, 298, 294, 291, 287, 284, 281, 278, 274, 271, 268, 265, 262, 259, 257, 507, 501, 496, 491, 485, 480, 475, 470, 465, 460, 456, 451, 446, 442, 437, 433, 428, 424, 420, 416, 412, 408, 404, 400, 396, 392, 388, 385, 381, 377, 374, 370, 367, 363, 360, 357, 354, 350, 347, 344, 341, 338, 335, 332, 329, 326, 323, 320, 318, 315, 312, 310, 307, 304, 302, 299, 297, 294, 292, 289, 287, 285, 282, 280, 278, 275, 273, 271, 269, 267, 265, 263, 261, 259]
                              , on = [9, 11, 12, 13, 13, 14, 14, 15, 15, 15, 15, 16, 16, 16, 16, 17, 17, 17, 17, 17, 17, 17, 18, 18, 18, 18, 18, 18, 18, 18, 18, 19, 19, 19, 19, 19, 19, 19, 19, 19, 19, 19, 19, 19, 19, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24];
                            w.addGetterSetter(ct, "blurRadius", 0, y(), w.afterSetFilter);
                            w.addGetterSetter(ct, "brightness", 0, y(), w.afterSetFilter);
                            w.addGetterSetter(ct, "contrast", 0, y(), w.afterSetFilter);
                            function an(t, e, i, n, r) {
                                var o = i - e
                                  , a = r - n;
                                return 0 == o ? n + a / 2 : 0 == a ? n : a * ((t - e) / o) + n
                            }
                            w.addGetterSetter(ct, "embossStrength", .5, y(), w.afterSetFilter),
                            w.addGetterSetter(ct, "embossWhiteLevel", .5, y(), w.afterSetFilter),
                            w.addGetterSetter(ct, "embossDirection", "top-left", null, w.afterSetFilter),
                            w.addGetterSetter(ct, "embossBlend", !1, null, w.afterSetFilter);
                            w.addGetterSetter(ct, "enhance", 0, y(), w.afterSetFilter);
                            w.addGetterSetter(ct, "hue", 0, y(), w.afterSetFilter),
                            w.addGetterSetter(ct, "saturation", 0, y(), w.afterSetFilter),
                            w.addGetterSetter(ct, "luminance", 0, y(), w.afterSetFilter);
                            w.addGetterSetter(ct, "hue", 0, y(), w.afterSetFilter),
                            w.addGetterSetter(ct, "saturation", 0, y(), w.afterSetFilter),
                            w.addGetterSetter(ct, "value", 0, y(), w.afterSetFilter);
                            function sn(t, e, i) {
                                var n = 4 * (i * t.width + e)
                                  , r = [];
                                return r.push(t.data[n++], t.data[n++], t.data[n++], t.data[n++]),
                                r
                            }
                            function hn(t, e) {
                                return Math.sqrt(Math.pow(t[0] - e[0], 2) + Math.pow(t[1] - e[1], 2) + Math.pow(t[2] - e[2], 2))
                            }
                            function ln(t, e) {
                                var i = sn(t, 0, 0)
                                  , n = sn(t, t.width - 1, 0)
                                  , r = sn(t, 0, t.height - 1)
                                  , o = sn(t, t.width - 1, t.height - 1)
                                  , a = e || 10;
                                if (hn(i, n) < a && hn(n, o) < a && hn(o, r) < a && hn(r, i) < a) {
                                    for (var s = function(t) {
                                        for (var e = [0, 0, 0], i = 0; i < t.length; i++)
                                            e[0] += t[i][0],
                                            e[1] += t[i][1],
                                            e[2] += t[i][2];
                                        return e[0] /= t.length,
                                        e[1] /= t.length,
                                        e[2] /= t.length,
                                        e
                                    }([n, i, o, r]), h = [], l = 0; l < t.width * t.height; l++) {
                                        var c = hn(s, [t.data[4 * l], t.data[4 * l + 1], t.data[4 * l + 2]]);
                                        h[l] = c < a ? 0 : 255
                                    }
                                    return h
                                }
                            }
                            w.addGetterSetter(ct, "kaleidoscopePower", 2, y(), w.afterSetFilter),
                            w.addGetterSetter(ct, "kaleidoscopeAngle", 0, y(), w.afterSetFilter);
                            w.addGetterSetter(ct, "threshold", 0, y(), w.afterSetFilter);
                            w.addGetterSetter(ct, "noise", .2, y(), w.afterSetFilter);
                            w.addGetterSetter(ct, "pixelSize", 8, y(), w.afterSetFilter);
                            w.addGetterSetter(ct, "levels", .5, y(), w.afterSetFilter);
                            w.addGetterSetter(ct, "red", 0, function(t) {
                                return this._filterUpToDate = !1,
                                255 < t ? 255 : t < 0 ? 0 : Math.round(t)
                            }),
                            w.addGetterSetter(ct, "green", 0, function(t) {
                                return this._filterUpToDate = !1,
                                255 < t ? 255 : t < 0 ? 0 : Math.round(t)
                            }),
                            w.addGetterSetter(ct, "blue", 0, v, w.afterSetFilter);
                            w.addGetterSetter(ct, "red", 0, function(t) {
                                return this._filterUpToDate = !1,
                                255 < t ? 255 : t < 0 ? 0 : Math.round(t)
                            }),
                            w.addGetterSetter(ct, "green", 0, function(t) {
                                return this._filterUpToDate = !1,
                                255 < t ? 255 : t < 0 ? 0 : Math.round(t)
                            }),
                            w.addGetterSetter(ct, "blue", 0, v, w.afterSetFilter),
                            w.addGetterSetter(ct, "alpha", 1, function(t) {
                                return this._filterUpToDate = !1,
                                1 < t ? 1 : t < 0 ? 0 : t
                            });
                            return w.addGetterSetter(ct, "threshold", .5, y(), w.afterSetFilter),
                            Ie.Util._assign(Ie, {
                                Arc: Le,
                                Arrow: ze,
                                Circle: Ye,
                                Ellipse: Ue,
                                Image: Ve,
                                Label: ni,
                                Tag: ai,
                                Line: Fe,
                                Path: li,
                                Rect: pi,
                                RegularPolygon: gi,
                                Ring: _i,
                                Sprite: Si,
                                Star: Pi,
                                Text: Li,
                                TextPath: Ni,
                                Transformer: Ji,
                                Wedge: tn,
                                Filters: {
                                    Blur: function(t) {
                                        var e = Math.round(this.blurRadius());
                                        0 < e && function(t, e) {
                                            for (var i, n, r, o, a, s, h, l, c, d, p, u, f, g, v, y, m, _, b, x, S, w, C, P = t.data, k = t.width, T = t.height, A = e + e + 1, M = k - 1, G = T - 1, R = e + 1, E = R * (R + 1) / 2, I = new nn, L = null, D = I, O = null, F = null, B = rn[e], N = on[e], z = 1; z < A; z++)
                                                D = D.next = new nn,
                                                z === R && (L = D);
                                            for (D.next = I,
                                            s = a = 0,
                                            n = 0; n < T; n++) {
                                                for (v = y = m = _ = h = l = c = d = 0,
                                                p = R * (b = P[a]),
                                                u = R * (x = P[a + 1]),
                                                f = R * (S = P[a + 2]),
                                                g = R * (w = P[a + 3]),
                                                h += E * b,
                                                l += E * x,
                                                c += E * S,
                                                d += E * w,
                                                D = I,
                                                z = 0; z < R; z++)
                                                    D.r = b,
                                                    D.g = x,
                                                    D.b = S,
                                                    D.a = w,
                                                    D = D.next;
                                                for (z = 1; z < R; z++)
                                                    r = a + ((M < z ? M : z) << 2),
                                                    h += (D.r = b = P[r]) * (C = R - z),
                                                    l += (D.g = x = P[r + 1]) * C,
                                                    c += (D.b = S = P[r + 2]) * C,
                                                    d += (D.a = w = P[r + 3]) * C,
                                                    v += b,
                                                    y += x,
                                                    m += S,
                                                    _ += w,
                                                    D = D.next;
                                                for (O = I,
                                                F = L,
                                                i = 0; i < k; i++)
                                                    P[a + 3] = w = d * B >> N,
                                                    0 !== w ? (w = 255 / w,
                                                    P[a] = (h * B >> N) * w,
                                                    P[a + 1] = (l * B >> N) * w,
                                                    P[a + 2] = (c * B >> N) * w) : P[a] = P[a + 1] = P[a + 2] = 0,
                                                    h -= p,
                                                    l -= u,
                                                    c -= f,
                                                    d -= g,
                                                    p -= O.r,
                                                    u -= O.g,
                                                    f -= O.b,
                                                    g -= O.a,
                                                    r = s + ((r = i + e + 1) < M ? r : M) << 2,
                                                    h += v += O.r = P[r],
                                                    l += y += O.g = P[r + 1],
                                                    c += m += O.b = P[r + 2],
                                                    d += _ += O.a = P[r + 3],
                                                    O = O.next,
                                                    p += b = F.r,
                                                    u += x = F.g,
                                                    f += S = F.b,
                                                    g += w = F.a,
                                                    v -= b,
                                                    y -= x,
                                                    m -= S,
                                                    _ -= w,
                                                    F = F.next,
                                                    a += 4;
                                                s += k
                                            }
                                            for (i = 0; i < k; i++) {
                                                for (y = m = _ = v = l = c = d = h = 0,
                                                p = R * (b = P[a = i << 2]),
                                                u = R * (x = P[a + 1]),
                                                f = R * (S = P[a + 2]),
                                                g = R * (w = P[a + 3]),
                                                h += E * b,
                                                l += E * x,
                                                c += E * S,
                                                d += E * w,
                                                D = I,
                                                z = 0; z < R; z++)
                                                    D.r = b,
                                                    D.g = x,
                                                    D.b = S,
                                                    D.a = w,
                                                    D = D.next;
                                                for (o = k,
                                                z = 1; z <= e; z++)
                                                    a = o + i << 2,
                                                    h += (D.r = b = P[a]) * (C = R - z),
                                                    l += (D.g = x = P[a + 1]) * C,
                                                    c += (D.b = S = P[a + 2]) * C,
                                                    d += (D.a = w = P[a + 3]) * C,
                                                    v += b,
                                                    y += x,
                                                    m += S,
                                                    _ += w,
                                                    D = D.next,
                                                    z < G && (o += k);
                                                for (a = i,
                                                O = I,
                                                F = L,
                                                n = 0; n < T; n++)
                                                    P[(r = a << 2) + 3] = w = d * B >> N,
                                                    0 < w ? (w = 255 / w,
                                                    P[r] = (h * B >> N) * w,
                                                    P[r + 1] = (l * B >> N) * w,
                                                    P[r + 2] = (c * B >> N) * w) : P[r] = P[r + 1] = P[r + 2] = 0,
                                                    h -= p,
                                                    l -= u,
                                                    c -= f,
                                                    d -= g,
                                                    p -= O.r,
                                                    u -= O.g,
                                                    f -= O.b,
                                                    g -= O.a,
                                                    r = i + ((r = n + R) < G ? r : G) * k << 2,
                                                    h += v += O.r = P[r],
                                                    l += y += O.g = P[r + 1],
                                                    c += m += O.b = P[r + 2],
                                                    d += _ += O.a = P[r + 3],
                                                    O = O.next,
                                                    p += b = F.r,
                                                    u += x = F.g,
                                                    f += S = F.b,
                                                    g += w = F.a,
                                                    v -= b,
                                                    y -= x,
                                                    m -= S,
                                                    _ -= w,
                                                    F = F.next,
                                                    a += k
                                            }
                                        }(t, e)
                                    },
                                    Brighten: function(t) {
                                        for (var e = 255 * this.brightness(), i = t.data, n = i.length, r = 0; r < n; r += 4)
                                            i[r] += e,
                                            i[r + 1] += e,
                                            i[r + 2] += e
                                    },
                                    Contrast: function(t) {
                                        for (var e = Math.pow((this.contrast() + 100) / 100, 2), i = t.data, n = i.length, r = 150, o = 150, a = 150, s = 0; s < n; s += 4)
                                            r = i[s],
                                            o = i[s + 1],
                                            a = i[s + 2],
                                            r /= 255,
                                            r -= .5,
                                            r *= e,
                                            r += .5,
                                            o /= 255,
                                            o -= .5,
                                            o *= e,
                                            o += .5,
                                            a /= 255,
                                            a -= .5,
                                            a *= e,
                                            a += .5,
                                            r = (r *= 255) < 0 ? 0 : 255 < r ? 255 : r,
                                            o = (o *= 255) < 0 ? 0 : 255 < o ? 255 : o,
                                            a = (a *= 255) < 0 ? 0 : 255 < a ? 255 : a,
                                            i[s] = r,
                                            i[s + 1] = o,
                                            i[s + 2] = a
                                    },
                                    Emboss: function(t) {
                                        var e = 10 * this.embossStrength()
                                          , i = 255 * this.embossWhiteLevel()
                                          , n = this.embossDirection()
                                          , r = this.embossBlend()
                                          , o = 0
                                          , a = 0
                                          , s = t.data
                                          , h = t.width
                                          , l = t.height
                                          , c = 4 * h
                                          , d = l;
                                        switch (n) {
                                        case "top-left":
                                            a = o = -1;
                                            break;
                                        case "top":
                                            o = -1,
                                            a = 0;
                                            break;
                                        case "top-right":
                                            o = -1,
                                            a = 1;
                                            break;
                                        case "right":
                                            o = 0,
                                            a = 1;
                                            break;
                                        case "bottom-right":
                                            a = o = 1;
                                            break;
                                        case "bottom":
                                            o = 1,
                                            a = 0;
                                            break;
                                        case "bottom-left":
                                            a = -(o = 1);
                                            break;
                                        case "left":
                                            o = 0,
                                            a = -1;
                                            break;
                                        default:
                                            A.error("Unknown emboss direction: " + n)
                                        }
                                        do {
                                            var p = (d - 1) * c
                                              , u = o;
                                            d + u < 1 && (u = 0),
                                            l < d + u && (u = 0);
                                            var f = (d - 1 + u) * h * 4
                                              , g = h;
                                            do {
                                                var v = p + 4 * (g - 1)
                                                  , y = a;
                                                g + y < 1 && (y = 0),
                                                h < g + y && (y = 0);
                                                var m, _, b, x, S = f + 4 * (g - 1 + y), w = s[v] - s[S], C = s[1 + v] - s[1 + S], P = s[2 + v] - s[2 + S], k = w, T = 0 < k ? k : -k;
                                                T < (0 < C ? C : -C) && (k = C),
                                                T < (0 < P ? P : -P) && (k = P),
                                                k *= e,
                                                r ? (m = s[v] + k,
                                                _ = s[1 + v] + k,
                                                b = s[2 + v] + k,
                                                s[v] = 255 < m ? 255 : m < 0 ? 0 : m,
                                                s[1 + v] = 255 < _ ? 255 : _ < 0 ? 0 : _,
                                                s[2 + v] = 255 < b ? 255 : b < 0 ? 0 : b) : ((x = i - k) < 0 ? x = 0 : 255 < x && (x = 255),
                                                s[v] = s[1 + v] = s[2 + v] = x)
                                            } while (--g)
                                        } while (--d)
                                    },
                                    Enhance: function(t) {
                                        var e, i, n, r, o, a, s, h, l, c, d, p, u, f = t.data, g = f.length, v = f[0], y = v, m = f[1], _ = m, b = f[2], x = b, S = this.enhance();
                                        if (0 !== S) {
                                            for (r = 0; r < g; r += 4)
                                                (e = f[r + 0]) < v ? v = e : y < e && (y = e),
                                                (i = f[r + 1]) < m ? m = i : _ < i && (_ = i),
                                                (n = f[r + 2]) < b ? b = n : x < n && (x = n);
                                            for (y === v && (y = 255,
                                            v = 0),
                                            _ === m && (_ = 255,
                                            m = 0),
                                            x === b && (x = 255,
                                            b = 0),
                                            u = 0 < S ? (a = y + S * (255 - y),
                                            s = v - S * v,
                                            l = _ + S * (255 - _),
                                            c = m - S * m,
                                            p = x + S * (255 - x),
                                            b - S * b) : (a = y + S * (y - (o = .5 * (y + v))),
                                            s = v + S * (v - o),
                                            l = _ + S * (_ - (h = .5 * (_ + m))),
                                            c = m + S * (m - h),
                                            p = x + S * (x - (d = .5 * (x + b))),
                                            b + S * (b - d)),
                                            r = 0; r < g; r += 4)
                                                f[r + 0] = an(f[r + 0], v, y, s, a),
                                                f[r + 1] = an(f[r + 1], m, _, c, l),
                                                f[r + 2] = an(f[r + 2], b, x, u, p)
                                        }
                                    },
                                    Grayscale: function(t) {
                                        for (var e, i = t.data, n = i.length, r = 0; r < n; r += 4)
                                            e = .34 * i[r] + .5 * i[r + 1] + .16 * i[r + 2],
                                            i[r] = e,
                                            i[r + 1] = e,
                                            i[r + 2] = e
                                    },
                                    HSL: function(t) {
                                        for (var e, i, n, r, o = t.data, a = o.length, s = Math.pow(2, this.saturation()), h = Math.abs(this.hue() + 360) % 360, l = 127 * this.luminance(), c = s * Math.cos(h * Math.PI / 180), d = s * Math.sin(h * Math.PI / 180), p = .299 + .701 * c + .167 * d, u = .587 - .587 * c + .33 * d, f = .114 - .114 * c - .497 * d, g = .299 - .299 * c - .328 * d, v = .587 + .413 * c + .035 * d, y = .114 - .114 * c + .293 * d, m = .299 - .3 * c + 1.25 * d, _ = .587 - .586 * c - 1.05 * d, b = .114 + .886 * c - .2 * d, x = 0; x < a; x += 4)
                                            e = o[x + 0],
                                            i = o[x + 1],
                                            n = o[x + 2],
                                            r = o[x + 3],
                                            o[x + 0] = p * e + u * i + f * n + l,
                                            o[x + 1] = g * e + v * i + y * n + l,
                                            o[x + 2] = m * e + _ * i + b * n + l,
                                            o[x + 3] = r
                                    },
                                    HSV: function(t) {
                                        for (var e, i, n, r, o = t.data, a = o.length, s = Math.pow(2, this.value()), h = Math.pow(2, this.saturation()), l = Math.abs(this.hue() + 360) % 360, c = s * h * Math.cos(l * Math.PI / 180), d = s * h * Math.sin(l * Math.PI / 180), p = .299 * s + .701 * c + .167 * d, u = .587 * s - .587 * c + .33 * d, f = .114 * s - .114 * c - .497 * d, g = .299 * s - .299 * c - .328 * d, v = .587 * s + .413 * c + .035 * d, y = .114 * s - .114 * c + .293 * d, m = .299 * s - .3 * c + 1.25 * d, _ = .587 * s - .586 * c - 1.05 * d, b = .114 * s + .886 * c - .2 * d, x = 0; x < a; x += 4)
                                            e = o[x + 0],
                                            i = o[x + 1],
                                            n = o[x + 2],
                                            r = o[x + 3],
                                            o[x + 0] = p * e + u * i + f * n,
                                            o[x + 1] = g * e + v * i + y * n,
                                            o[x + 2] = m * e + _ * i + b * n,
                                            o[x + 3] = r
                                    },
                                    Invert: function(t) {
                                        for (var e = t.data, i = e.length, n = 0; n < i; n += 4)
                                            e[n] = 255 - e[n],
                                            e[n + 1] = 255 - e[n + 1],
                                            e[n + 2] = 255 - e[n + 2]
                                    },
                                    Kaleidoscope: function(t) {
                                        var e, i, n, r, o, a, s, h, l, c = t.width, d = t.height, p = Math.round(this.kaleidoscopePower()), u = Math.round(this.kaleidoscopeAngle()), f = Math.floor(c * (u % 360) / 360);
                                        if (!(p < 1)) {
                                            var g = A.createCanvasElement();
                                            g.width = c,
                                            g.height = d;
                                            var v = g.getContext("2d").getImageData(0, 0, c, d);
                                            !function(t, e, i) {
                                                for (var n, r, o, a, s = t.data, h = e.data, l = t.width, c = t.height, d = i.polarCenterX || l / 2, p = i.polarCenterY || c / 2, u = 0, f = 0, g = 0, v = 0, y = Math.sqrt(d * d + p * p), m = l - d, _ = c - p, b = Math.sqrt(m * m + _ * _), y = y < b ? b : y, x = c, S = l, w = 360 / S * Math.PI / 180, C = 0; C < S; C += 1)
                                                    for (o = Math.sin(C * w),
                                                    a = Math.cos(C * w),
                                                    r = 0; r < x; r += 1)
                                                        m = Math.floor(d + y * r / x * a),
                                                        u = s[(n = 4 * ((_ = Math.floor(p + y * r / x * o)) * l + m)) + 0],
                                                        f = s[n + 1],
                                                        g = s[n + 2],
                                                        v = s[n + 3],
                                                        h[(n = 4 * (C + r * l)) + 0] = u,
                                                        h[n + 1] = f,
                                                        h[n + 2] = g,
                                                        h[n + 3] = v
                                            }(t, v, {
                                                polarCenterX: c / 2,
                                                polarCenterY: d / 2
                                            });
                                            for (var y = c / Math.pow(2, p); y <= 8; )
                                                y *= 2,
                                                --p;
                                            var m = y = Math.ceil(y)
                                              , _ = 0
                                              , b = m
                                              , x = 1;
                                            for (c < f + y && (_ = m,
                                            b = 0,
                                            x = -1),
                                            i = 0; i < d; i += 1)
                                                for (e = _; e !== b; e += x)
                                                    h = 4 * (c * i + Math.round(e + f) % c),
                                                    r = v.data[h + 0],
                                                    o = v.data[h + 1],
                                                    a = v.data[h + 2],
                                                    s = v.data[h + 3],
                                                    l = 4 * (c * i + e),
                                                    v.data[l + 0] = r,
                                                    v.data[l + 1] = o,
                                                    v.data[l + 2] = a,
                                                    v.data[l + 3] = s;
                                            for (i = 0; i < d; i += 1)
                                                for (m = Math.floor(y),
                                                n = 0; n < p; n += 1) {
                                                    for (e = 0; e < m + 1; e += 1)
                                                        h = 4 * (c * i + e),
                                                        r = v.data[h + 0],
                                                        o = v.data[h + 1],
                                                        a = v.data[h + 2],
                                                        s = v.data[h + 3],
                                                        l = 4 * (c * i + 2 * m - e - 1),
                                                        v.data[l + 0] = r,
                                                        v.data[l + 1] = o,
                                                        v.data[l + 2] = a,
                                                        v.data[l + 3] = s;
                                                    m *= 2
                                                }
                                            !function(t, e, i) {
                                                var n, r, o, a, s, h, l = t.data, c = e.data, d = t.width, p = t.height, u = i.polarCenterX || d / 2, f = i.polarCenterY || p / 2, g = 0, v = 0, y = 0, m = 0, _ = Math.sqrt(u * u + f * f), b = d - u, x = p - f, S = Math.sqrt(b * b + x * x), _ = _ < S ? S : _, w = p, C = d, P = i.polarRotation || 0;
                                                for (b = 0; b < d; b += 1)
                                                    for (x = 0; x < p; x += 1)
                                                        r = b - u,
                                                        o = x - f,
                                                        a = Math.sqrt(r * r + o * o) * w / _,
                                                        s = (s = (180 * Math.atan2(o, r) / Math.PI + 360 + P) % 360) * C / 360,
                                                        h = Math.floor(s),
                                                        g = l[(n = 4 * (Math.floor(a) * d + h)) + 0],
                                                        v = l[n + 1],
                                                        y = l[n + 2],
                                                        m = l[n + 3],
                                                        c[(n = 4 * (x * d + b)) + 0] = g,
                                                        c[n + 1] = v,
                                                        c[n + 2] = y,
                                                        c[n + 3] = m
                                            }(v, t, {
                                                polarRotation: 0
                                            })
                                        }
                                    },
                                    Mask: function(t) {
                                        var e = ln(t, this.threshold());
                                        return e && function(t, e) {
                                            for (var i = 0; i < t.width * t.height; i++)
                                                t.data[4 * i + 3] = e[i]
                                        }(t, e = function(t, e, i) {
                                            for (var n = [1 / 9, 1 / 9, 1 / 9, 1 / 9, 1 / 9, 1 / 9, 1 / 9, 1 / 9, 1 / 9], r = Math.round(Math.sqrt(n.length)), o = Math.floor(r / 2), a = [], s = 0; s < i; s++)
                                                for (var h = 0; h < e; h++) {
                                                    for (var l = s * e + h, c = 0, d = 0; d < r; d++)
                                                        for (var p = 0; p < r; p++) {
                                                            var u, f = s + d - o, g = h + p - o;
                                                            0 <= f && f < i && 0 <= g && g < e && (u = n[d * r + p],
                                                            c += t[f * e + g] * u)
                                                        }
                                                    a[l] = c
                                                }
                                            return a
                                        }(e = function(t, e, i) {
                                            for (var n = [1, 1, 1, 1, 1, 1, 1, 1, 1], r = Math.round(Math.sqrt(n.length)), o = Math.floor(r / 2), a = [], s = 0; s < i; s++)
                                                for (var h = 0; h < e; h++) {
                                                    for (var l = s * e + h, c = 0, d = 0; d < r; d++)
                                                        for (var p = 0; p < r; p++) {
                                                            var u, f = s + d - o, g = h + p - o;
                                                            0 <= f && f < i && 0 <= g && g < e && (u = n[d * r + p],
                                                            c += t[f * e + g] * u)
                                                        }
                                                    a[l] = 1020 <= c ? 255 : 0
                                                }
                                            return a
                                        }(e = function(t, e, i) {
                                            for (var n = [1, 1, 1, 1, 0, 1, 1, 1, 1], r = Math.round(Math.sqrt(n.length)), o = Math.floor(r / 2), a = [], s = 0; s < i; s++)
                                                for (var h = 0; h < e; h++) {
                                                    for (var l = s * e + h, c = 0, d = 0; d < r; d++)
                                                        for (var p = 0; p < r; p++) {
                                                            var u, f = s + d - o, g = h + p - o;
                                                            0 <= f && f < i && 0 <= g && g < e && (u = n[d * r + p],
                                                            c += t[f * e + g] * u)
                                                        }
                                                    a[l] = 2040 === c ? 255 : 0
                                                }
                                            return a
                                        }(e, t.width, t.height), t.width, t.height), t.width, t.height)),
                                        t
                                    },
                                    Noise: function(t) {
                                        for (var e = 255 * this.noise(), i = t.data, n = i.length, r = e / 2, o = 0; o < n; o += 4)
                                            i[o + 0] += r - 2 * r * Math.random(),
                                            i[o + 1] += r - 2 * r * Math.random(),
                                            i[o + 2] += r - 2 * r * Math.random()
                                    },
                                    Pixelate: function(t) {
                                        var e, i, n, r, o, a, s, h, l, c, d, p, u, f, g = Math.ceil(this.pixelSize()), v = t.width, y = t.height, m = Math.ceil(v / g), _ = Math.ceil(y / g), b = t.data;
                                        if (g <= 0)
                                            A.error("pixelSize value can not be <= 0");
                                        else
                                            for (p = 0; p < m; p += 1)
                                                for (u = 0; u < _; u += 1) {
                                                    for (l = (h = p * g) + g,
                                                    d = (c = u * g) + g,
                                                    f = s = a = o = r = 0,
                                                    e = h; e < l; e += 1)
                                                        if (!(v <= e))
                                                            for (i = c; i < d; i += 1)
                                                                y <= i || (r += b[(n = 4 * (v * i + e)) + 0],
                                                                o += b[n + 1],
                                                                a += b[n + 2],
                                                                s += b[n + 3],
                                                                f += 1);
                                                    for (r /= f,
                                                    o /= f,
                                                    a /= f,
                                                    s /= f,
                                                    e = h; e < l; e += 1)
                                                        if (!(v <= e))
                                                            for (i = c; i < d; i += 1)
                                                                y <= i || (b[(n = 4 * (v * i + e)) + 0] = r,
                                                                b[n + 1] = o,
                                                                b[n + 2] = a,
                                                                b[n + 3] = s)
                                                }
                                    },
                                    Posterize: function(t) {
                                        for (var e = Math.round(254 * this.levels()) + 1, i = t.data, n = i.length, r = 255 / e, o = 0; o < n; o += 1)
                                            i[o] = Math.floor(i[o] / r) * r
                                    },
                                    RGB: function(t) {
                                        for (var e, i = t.data, n = i.length, r = this.red(), o = this.green(), a = this.blue(), s = 0; s < n; s += 4)
                                            e = (.34 * i[s] + .5 * i[s + 1] + .16 * i[s + 2]) / 255,
                                            i[s] = e * r,
                                            i[s + 1] = e * o,
                                            i[s + 2] = e * a,
                                            i[s + 3] = i[s + 3]
                                    },
                                    RGBA: function(t) {
                                        for (var e, i = t.data, n = i.length, r = this.red(), o = this.green(), a = this.blue(), s = this.alpha(), h = 0; h < n; h += 4)
                                            e = 1 - s,
                                            i[h] = r * s + i[h] * e,
                                            i[h + 1] = o * s + i[h + 1] * e,
                                            i[h + 2] = a * s + i[h + 2] * e
                                    },
                                    Sepia: function(t) {
                                        for (var e, i, n, r = t.data, o = r.length, a = 0; a < o; a += 4)
                                            e = r[a + 0],
                                            i = r[a + 1],
                                            n = r[a + 2],
                                            r[a + 0] = Math.min(255, .393 * e + .769 * i + .189 * n),
                                            r[a + 1] = Math.min(255, .349 * e + .686 * i + .168 * n),
                                            r[a + 2] = Math.min(255, .272 * e + .534 * i + .131 * n)
                                    },
                                    Solarize: function(t) {
                                        var e = t.data
                                          , i = t.width
                                          , n = 4 * i
                                          , r = t.height;
                                        do {
                                            var o = (r - 1) * n
                                              , a = i;
                                            do {
                                                var s = o + 4 * (a - 1)
                                                  , h = e[s]
                                                  , l = e[1 + s]
                                                  , c = e[2 + s];
                                                127 < h && (h = 255 - h),
                                                127 < l && (l = 255 - l),
                                                127 < c && (c = 255 - c),
                                                e[s] = h,
                                                e[1 + s] = l,
                                                e[2 + s] = c
                                            } while (--a)
                                        } while (--r)
                                    },
                                    Threshold: function(t) {
                                        for (var e = 255 * this.threshold(), i = t.data, n = i.length, r = 0; r < n; r += 1)
                                            i[r] = i[r] < e ? 0 : 255
                                    }
                                }
                            })
                        });

                        if (document.querySelector('#cf-theme-styles') == null) {
                            var style = document.createElement('style');
                            style.id = 'cf-theme-styles';
                            style.innerHTML = `:root {--cf-background-default: #fefcfd; --cf-background-success: #009b72; --cf-background-error: #f24c00; --cf-text-default: #04030f; --cf-text-additional: #eee; --cf-text-disabled: #53687e; } .cf_drawer * {-webkit-tap-highlight-color: rgba(0, 0, 0, 0); box-sizing: border-box; font-family: "Roboto", sans-serif; } .cf_drawer .konvajs-content {z-index: 2; } .cf_canvas__wrapper {display: flex; flex-wrap: wrap; } .cf_block {display: flex; flex-wrap: wrap; color: var(--cf-text-default); margin-bottom: 22px; gap: 4px; } .cf_block:last-child {margin-bottom: 0; } .cf_block.cf_state-controls {flex: 1; align-items: flex-end; } .cf_tools-container {display: flex; overflow: hidden; } .cf_tools-container .cf_tools-toggle {width: 26px; position: relative; background: var(--cf-text-additional); z-index: 1; overflow: hidden; } .cf_tools-container .cf_tools-toggle:hover {cursor: pointer; } .cf_tools-container .cf_tools-toggle:before {content: ""; position: absolute; left: 0; top: 0; height: 100%; width: 100%; background: url(expand-button.svg); background-repeat: no-repeat; background-position: center; background-size: 20px; transform: rotate(-90deg); transition: all 0.25s; } .cf_tools-container.active .cf_tools-toggle:before {transform: rotate(-90deg) scaleY(-1); } .cf_tools-wrapper {display: flex; flex-direction: column; width: 230px; margin-left: -100%; padding: 10px 18px; overflow: hidden; transition: all 0.5s; backdrop-filter: blur(6px); } .cf_tools-container.active .cf_tools-wrapper {margin-left: 0 !important; margin-right: 0 !important; } .cf_title {width: 100%; font-size: 14px; padding-left: 10px; color: var(--cf-text-default); letter-spacing: 0.034em; margin-bottom: 4px; } .cf_button {background-color: var(--cf-text-additional); color: var(--cf-text-default); transition: all 0.25s; height: 30px; font-size: 14px; border-radius: 5px; border: none; padding: 10px 15px; display: flex; justify-content: center; align-items: center; } .cf_button:focus {outline: none; } .cf_button:not(:disabled):hover {cursor: pointer; background-color: #f6f6f6; } .cf_button:disabled {opacity: 0.45; } .cf_button.cf_context-menu__button {border-radius: 0; justify-content: flex-start; } .cf_context-menu {z-index: 3; } .cf_button.cf_state-undo, .cf_button.cf_state-redo {color: transparent; background-image: url(assets/img/undo.svg); background-size: 15px; background-position: center; background-repeat: no-repeat; } .cf_button.cf_state-redo {transform: rotate(180deg) scaleY(-1); } .cf_field {display: flex; flex-direction: row-reverse; } .cf_label-checkbox {color: transparent; } .cf_image-source {display: none; } /* left side mode */ .cf_canvas__wrapper.cf_canvas__wrapper-left, .cf_canvas__wrapper.cf_canvas__wrapper-left .cf_tools-container{flex-direction: row-reverse; } .cf_canvas__wrapper.cf_canvas__wrapper-left .cf_tools-container .cf_tools-wrapper{margin-right: -100%; } .cf_canvas__wrapper.cf_canvas__wrapper-left .cf_tools-container .cf_tools-toggle:before{transform: rotate(-90deg) scaleY(-1); } .cf_tools-container.active .cf_tools-toggle:before {transform: rotate(-90deg) scaleY(1); } .cf_drawer input[type="number"] {color: var(--cf-text-default); width: 50px; } .cf_drawer input[type="checkbox"] + label {display: block; cursor: pointer; width: 30px; height: 30px; } .cf_drawer input[type="checkbox"] {display: none; } .cf_drawer input[type="checkbox"] + label {border-left: 4px solid var(--cf-background-error); background-image: url(draw.png); background-size: 20px; background-position: center; background-repeat: no-repeat; } .cf_drawer input[type="checkbox"]:checked + label {border: none; border-right: 4px solid var(--cf-background-success); -webkit-transform: rotate(180deg); -moz-transform: rotate(180deg); -ms-transform: rotate(180deg); -o-transform: rotate(180deg); transform: rotate(180deg); } .cf_drawer input[type="color"] {-webkit-appearance: none; border: none; background: #fff; width: 30px; height: 30px; overflow: hidden; outline: none; cursor: inherit; padding: 0; border-radius: 50%; border: 1px solid var(--cf-text-additional); } .cf_drawer input[type="color"]:not(:disabled):hover {cursor: pointer; } .cf_drawer input[type="color"]::-webkit-color-swatch-wrapper {padding: 0; } .cf_drawer input[type="color"]::-webkit-color-swatch {border: none; } .cf_drawer input[type="color"]::-moz-focus-inner {border: none; padding: 0; } .cf_drawer input[type="color"]::-moz-color-swatch {border: none; height: 30px; } .cf_drawer .cf_row{display:flex;} .cf_drawer .cf_row .cf_input{width: 100%;} .cf_drawer .cf_text{margin-bottom: 14px;}`;
                            document.head.appendChild(style);
                        }
                    }
                    //konva end

                    //params parse
                    let extensions = JSON.parse(extensionsJSON);

                    //layout block
                    if (Array.isArray(selector)) {
                        let firstItem = selector[0];
                        if (firstItem == 'QUERYSELECTOR') {
                            selector = selector[1];
                        } else if (firstItem == 'CONTAINER') {
                            selector = '#v3d-container';
                        }
                    }
                    let parent = document.querySelector(selector);

                    let uniq = document.querySelectorAll('.cf_canvas__wrapper').length + 1;
                    let wrapperId = `cf_root${uniq}`;
                    let canvasId = `cf_canvas${uniq}`;
                    let stageId = `cf_stage${uniq}`;

                    let drawer = document.createElement('div');
                    drawer.className = `cf_drawer`;
                    drawer.id = `cf_drawer${uniq}`;
                    drawer = parent.appendChild(drawer);

                    let wrapper = document.createElement('div');
                    wrapper.className = 'cf_canvas__wrapper';
                    wrapper.id = wrapperId;
                    wrapper.position = 'relative';
                    wrapper = drawer.appendChild(wrapper);

                    if (toolsPanelSide == 'left') {
                        wrapper.classList.add('cf_canvas__wrapper-left');
                    }
                    //layout block end

                    function getActiveTransformerItems() {
                        let items = [];
                        layer.getChildren().forEach(function(item) {
                            if (item.className == 'Transformer') {
                                items = item.nodes();
                            }
                        });
                        return items;
                    }

                    //konva prepare
                    let scale = (canvasScale == undefined ? 1 : canvasScale);
                    let container_width = (containerWidth == undefined ? 200 : containerWidth);
                    let container_height = (containerHeight == undefined ? 200 : containerHeight);

                    let stageOpt = {
                        width: (container_width * scale),
                        height: (container_height * scale),
                        container: wrapper,
                        id: stageId
                    };

                    var stage = new Konva.Stage(stageOpt);
                    var layer = new Konva.Layer();
                    backgroundLayers(stage, layer);
                    containerBackgroundLayers(stage, layer, true);
                    stage.add(layer);

                    // stage canvas
                    let canvas = wrapper.querySelector('canvas');
                    canvas.id = canvasId;
                    canvas.dataset.stage = stageId;
                    canvas.getContext("2d").scale(scale, scale);

                    wrapper.querySelector('.konvajs-content').style.width = `${container_width}px`;
                    wrapper.querySelector('.konvajs-content').style.height = `${container_height}px`;
                    canvas.style.width = `${container_width}px`;
                    canvas.style.height = `${container_height}px`;
                    wrapper.style.width = `100%`;
                    wrapper.style.height = `100%`;
                    drawer.style.height = `${container_height}px`;

                    stage.cfScale = scale;

                    window.updateTexture = function(stageLocal) {
                        let canvasLocalId = stageLocal.content.firstChild.id;

                        let allTextures = v3d.puzzles.canvasTextures;
                        if (allTextures !== undefined) {
                            var canvasTex = allTextures[canvasLocalId];

                            if (canvasTex !== undefined) {
                                canvasTex.needsUpdate = true;
                            }
                        }
                    }

                    function clearTransforms() {
                        var transformers = layer.find('Transformer').toArray().forEach(function(item) {
                            item.destroy();
                        });

                        layer.draw();
                        updateTexture(stage);
                    }

                    //konva prepare end

                    //konva extras
                    if (Object.getOwnPropertyNames(extensions).length > 0) {
                        let toolsContainer = document.createElement('div');
                        toolsContainer.className = 'cf_tools-container';
                        toolsContainer.innerHTML = `
                    <div class="cf_tools-toggle"></div>
                    <div class="cf_tools-wrapper"></div>
                    `;
                        toolsContainer = wrapper.appendChild(toolsContainer);
                        let toolsWrapper = toolsContainer.querySelector('.cf_tools-wrapper');

                        //tools visual
                        toolsContainer.querySelector('.cf_tools-toggle').addEventListener('click', function() {
                            this.parentElement.classList.toggle('active');
                        });
                        //tools visual end

                        function stopDrawing() {
                            //prevent from drawing
                            wrapper.querySelectorAll('.cf_drawing-enable').forEach(function(item) {
                                item.checked = false;
                            });
                            if (stage.cfDrawingConfig) {
                                stage.cfDrawingConfig.cfDrawingModeEnabled = false;
                            }
                        }

                        if (extensions.add_draw_mode) {

                            stage.cfDrawingConfig = {
                                cfDrawingModeEnabled: true,
                                cfIsPaint: false,
                                cfMode: 'brush',
                                cfBrushColor: '#000',
                                cfstrokeWidth: 2,
                                lastLine: []
                            };

                            stage.on('mousedown touchstart', function(e) {

                                let canDraw = stage.cfDrawingConfig.cfDrawingModeEnabled;

                                //drawing
                                if (canDraw) {

                                    stage.cfDrawingConfig.cfIsPaint = true;

                                    var pos = stage.getPointerPosition();

                                    stage.cfDrawingConfig.lastLine = new Konva.Line({
                                        stroke: stage.cfDrawingConfig.cfBrushColor,
                                        strokeWidth: stage.cfDrawingConfig.cfstrokeWidth / scale,
                                        globalCompositeOperation: stage.cfDrawingConfig.cfMode === 'brush' ? 'source-over' : 'destination-out',
                                        points: [pos.x, pos.y],
                                        name: 'line',
                                        listening: false
                                    });
                                    layer.add(stage.cfDrawingConfig.lastLine);
                                }
                                //drawing end

                                layer.draw();
                                updateTexture(stage);
                            });

                            stage.on('mouseup touchend', function() {
                                if (stage.cfDrawingConfig.cfIsPaint) {
                                    window.saveStateToHistory();
                                    updateTexture(stage);

                                    stage.cfDrawingConfig.cfIsPaint = false;
                                }
                            });

                            // and core function - drawing
                            stage.on('mousemove touchmove', function() {

                                if (stage.cfDrawingConfig.cfIsPaint) {
                                    var pos = stage.getPointerPosition();

                                    var newPoints = stage.cfDrawingConfig.lastLine.points().concat([pos.x, pos.y]);
                                    stage.cfDrawingConfig.lastLine.points(newPoints);
                                }

                                layer.draw();
                                updateTexture(stage);
                            });
                        }

                        if (extensions.add_draw_mode && extensions.add_drawing_tools_mode) {

                            stage.cfDrawingConfig.cfDrawingModeEnabled = false;

                            // let drawingModeChange = `<select class="cf_drawing-mode" data-stage="${stageId}">
                            //     <option value="brush">Brush</option>
                            //     <option value="eraser">Eraser</option>
                            // </select>`;

                            let drawingToolsNode = document.createElement('div');
                            drawingToolsNode.className = 'cf_block cf_drawing';
                            drawingToolsNode.innerHTML = `
                    <div class="cf_title">Draw</div>

                    <input id="cf_drawing-enable${uniq}" type="checkbox" class="cf_drawing-enable" data-stage="${stageId}"/>
                    <label class="cf_label cf_label-checkbox" for="cf_drawing-enable${uniq}"></label>

                    <input id="cf_drawing-color${uniq}" type="color" class="cf_drawing-color" data-stage="${stageId}"/>
                    <label class="cf_label cf_label-color" for="cf_drawing-color${uniq}"></label>

                    <input id="cf_drawing-size${uniq}" type="number" class="cf_drawing-size" step="0.1" min="0.1" value="1" data-stage="${stageId}"/>
                    <label class="cf_label cf_label-number" for="cf_drawing-size${uniq}"></label>
                    `;
                            drawingToolsNode = toolsWrapper.appendChild(drawingToolsNode);

                            //enable drawing
                            drawingToolsNode.querySelectorAll('.cf_drawing-enable').forEach(function(item) {
                                item.addEventListener('change', function() {
                                    Konva.ids[item.dataset.stage].cfDrawingConfig.cfDrawingModeEnabled = item.checked;
                                })
                            });

                            //draw mode
                            // drawingToolsNode.querySelectorAll('.cf_drawing-mode').forEach(function (item) {
                            //     item.addEventListener('change', function () {
                            //         Konva.ids[item.dataset.stage].cfDrawingConfig.cfMode = item.value;
                            //     })
                            // });

                            //brush color
                            drawingToolsNode.querySelectorAll('.cf_drawing-color').forEach(function(item) {
                                item.addEventListener('input', function() {
                                    Konva.ids[item.dataset.stage].cfDrawingConfig.cfBrushColor = item.value;
                                })
                            });

                            //brush size
                            drawingToolsNode.querySelectorAll('.cf_drawing-size').forEach(function(item) {
                                item.addEventListener('input', function() {
                                    Konva.ids[item.dataset.stage].cfDrawingConfig.cfstrokeWidth = item.value;
                                })
                            });
                        }

                        if (extensions.add_image_upload_mode) {

                            //uploading input
                            let imageBlock = document.createElement('div');
                            imageBlock.className = 'cf_block cf_image';
                            imageBlock.innerHTML = `
                    <div class="cf_title">Image Upload</div>
                    <label class="cf_button cf_image-wrapper">
                        Upload image
                    </label>
                    `;
                            imageBlock = toolsWrapper.appendChild(imageBlock);
                            let imageSource = document.createElement('input');
                            imageSource.type = 'file';
                            imageSource.className = 'cf_image-source';
                            // imageSource.style.display = 'none';
                            imageSource = imageBlock.querySelector('.cf_image-wrapper').appendChild(imageSource);

                            imageSource.onchange = (eim) => {
                                var fr = new FileReader()
                                fr.readAsDataURL(eim.target.files[0])
                                fr.onload = function(e) {

                                    //prevent from drawing
                                    stopDrawing();

                                    //loading to layer
                                    Konva.Image.fromURL(this.result, function(image) {
                                        let width = image.width();
                                        let height = image.height();

                                        const scale = Math.min(container_width * 0.9 / width, container_height * 0.9 / height);

                                        width = width * scale;
                                        height = height * scale;

                                        image.setAttrs({
                                            width,
                                            height,
                                            x: 0,
                                            y: 0,
                                            name: 'image' + Date.now(),
                                            draggable: true,
                                        });
                                        image.on('dragmove transform', function() {
                                            //prevent drawing
                                            stopDrawing();

                                            layer.draw();
                                            updateTexture(stage);
                                        });
                                        image.on('mousedown', function() {
                                            //prevent drawing
                                            stopDrawing();
                                        });
                                        image.on('mouseup', function() {
                                            window.saveStateToHistory();
                                        });

                                        layer.add(image);

                                        layer.draw();
                                        window.saveStateToHistory();
                                        updateTexture(stage);

                                        eim.target.value = '';
                                    });
                                    //loading to layer end
                                }
                            }
                            ;

                        }

                        if (extensions.add_transform_mode) {

                            let contextMenuNode = document.createElement('div');
                            contextMenuNode.className = 'cf_context-menu';
                            contextMenuNode.style.display = 'none';
                            contextMenuNode.innerHTML = `
                    <div class="cf_button cf_context-menu__button" data-action="up">Layer Up</div>
                    <div class="cf_button cf_context-menu__button" data-action="down">Layer Down</div>
                    <div class="cf_button cf_context-menu__button" data-action="remove">Remove</div>
                    `;
                            contextMenuNode = wrapper.appendChild(contextMenuNode);
                            stage.cfTransforming = {
                                menuNode: contextMenuNode
                            };

                            //menu buttons event bounding
                            contextMenuNode.querySelectorAll('.cf_context-menu__button').forEach(function(item) {
                                item.addEventListener('click', (e) => {
                                    let btnNode = e.target;
                                    var action = btnNode.dataset.action;
                                    const tr = layer.find('Transformer').toArray().find(tr => tr.nodes()[0] === stage.cfTransforming.currentShape);

                                    if (action == 'up') {
                                        stage.cfTransforming.currentShape.moveUp();
                                    } else if (action == 'down') {
                                        stage.cfTransforming.currentShape.moveDown();
                                    } else if (action == 'remove') {
                                        stage.cfTransforming.currentShape.destroy();
                                        if (tr) {
                                            tr.destroy();
                                        }

                                        //hide menu after action
                                        stage.cfTransforming.menuNode.style.display = 'none';
                                    }

                                    layer.draw();
                                    window.saveStateToHistory();
                                    updateTexture(stage);
                                }
                                );
                            });

                            stage.on('click', function(e) {
                                clearTransforms();

                                let elem = e.target;
                                let elemName = elem.attrs.name || null;
                                if (elem !== stage && elemName !== null && elemName != 'line') {

                                    let transformArgs = {
                                        nodes: [elem],
                                        keepRatio: true,
                                        borderEnabled: true,
                                        boundBoxFunc: (oldBox, newBox) => {
                                            if (newBox.width < 10 || newBox.height < 10) {
                                                return oldBox;
                                            }
                                            return newBox;
                                        }
                                        ,
                                    };

                                    if (elemName.includes('text')) {
                                        transformArgs.enabledAnchors = ['middle-left', 'middle-right'];
                                    }
                                    const tr = new Konva.Transformer(transformArgs);
                                    layer.add(tr);
                                }

                                if (elem === stage || elemName == null || elemName == 'line') {
                                    stage.cfTransforming.menuNode.style.display = 'none';
                                }

                                layer.draw();
                                updateTexture(stage);
                            });

                            stage.on('contextmenu', function(e) {
                                //prevent drawing
                                stopDrawing();

                                // prevent default behavior
                                e.evt.preventDefault();

                                let elem = e.target;
                                let elemName = elem.attrs.name || null;
                                if (elem === stage || elemName == null || elemName == 'line') {
                                    stage.cfTransforming.menuNode.style.display = 'none';
                                    return;
                                }

                                stage.cfTransforming.currentShape = elem;
                                // show menu
                                stage.cfTransforming.menuNode.style.display = 'block';
                                stage.cfTransforming.menuNode.style.position = 'absolute';
                                stage.cfTransforming.menuNode.style.top = e.evt.layerY + 'px';
                                stage.cfTransforming.menuNode.style.left = e.evt.layerX + 'px';

                                let menuBounds = stage.cfTransforming.menuNode.getBoundingClientRect();
                                if (menuBounds.bottom > window.innerHeight) {
                                    stage.cfTransforming.menuNode.style.top = `${(e.evt.layerY - menuBounds.height)}px`;
                                }
                                if (menuBounds.right > window.innerWidth) {
                                    stage.cfTransforming.menuNode.style.left = `${(e.evt.layerX - menuBounds.width)}px`;
                                }
                            });
                        }

                        if (extensions.add_text_mode) {
                            stage.cfTextConfig = {
                                fontSize: 12,
                                fontColor: 'black'
                            };

                            let textToolsNode = document.createElement('div');
                            textToolsNode.className = 'cf_block cf_text';
                            textToolsNode.innerHTML = `
                    <div class="cf_title">Text</div>
                    <input type="color" class="cf_text-color" data-stage="${stageId}"/>
                    <label class="cf_label cf_label-color"></label>

                    <input type="number" class="cf_text-size" step="1" min="1" value="12" data-stage="${stageId}"/>
                    <label class="cf_label cf_label-number"></label>

                    <button class="cf_button cf_text-add">Add Text</button>
                    <div class="cf_row" style="margin-top: 6px;">
                        <small>Font</small>
                        <select class="cf_input cf_text-font" style="margin-left: 8px;">
                            <option value="Arial">Arial</option>
                            <option value="Courier">Courier</option>
                            <option value="Georgia">Georgia</option>
                            <option value="'Roboto', sans-serif" selected>Roboto</option>
                            <option value="Times New Roman">Times New Roman</option>
                        </select>
                    </div>
                    `;
                            textToolsNode = toolsWrapper.appendChild(textToolsNode);

                            textToolsNode.querySelectorAll('.cf_text-add').forEach(function(item) {
                                item.addEventListener('click', function() {

                                    //prevent drawing
                                    stopDrawing();

                                    console.log(textToolsNode);
                                    let fontFamily = textToolsNode.querySelectorAll('.cf_text-font')[0].value;
                                    let textNode = new Konva.Text({
                                        text: 'New text here',
                                        x: 10,
                                        y: 10,
                                        fontSize: stage.cfTextConfig.fontSize,
                                        fontFamily: fontFamily,
                                        draggable: true,
                                        width: 100,
                                        name: 'text' + Date.now(),
                                        fill: stage.cfTextConfig.fontColor
                                    });
                                    textNode.on('transform', function() {
                                        textNode.setAttrs({
                                            width: textNode.width() * textNode.scaleX(),
                                            scaleX: 1,
                                        });

                                        updateTexture(stage);
                                    });

                                    //editing text
                                    textNode.on('dblclick dbltap', () => {

                                        //prevent drawing
                                        stopDrawing();

                                        textNode.hide();
                                        layer.draw();

                                        var textPosition = textNode.absolutePosition();

                                        var areaPosition = {
                                            x: stage.container().offsetLeft + textPosition.x,
                                            y: stage.container().offsetTop + textPosition.y,
                                        };

                                        var textarea = document.createElement('textarea');
                                        stage.content.appendChild(textarea);

                                        textarea.value = textNode.text();
                                        textarea.style.position = 'absolute';
                                        textarea.style.top = areaPosition.y + 'px';
                                        textarea.style.left = areaPosition.x + 'px';
                                        textarea.style.width = (textNode.width()) - textNode.padding() * 2 + 'px';
                                        textarea.style.height = textNode.height() - textNode.padding() * 2 + 5 + 'px';
                                        textarea.style.fontSize = textNode.fontSize() + 'px';
                                        textarea.style.border = 'none';
                                        textarea.style.padding = '0px';
                                        textarea.style.margin = '0px';
                                        textarea.style.overflow = 'hidden';
                                        textarea.style.background = 'none';
                                        textarea.style.outline = 'none';
                                        textarea.style.resize = 'none';
                                        textarea.style.lineHeight = textNode.lineHeight();
                                        textarea.style.fontFamily = textNode.fontFamily();
                                        textarea.style.transformOrigin = 'left top';
                                        textarea.style.textAlign = textNode.align();
                                        textarea.style.color = textNode.fill();
                                        let rotation = textNode.rotation();
                                        var transform = '';
                                        if (rotation) {
                                            transform += 'rotateZ(' + rotation + 'deg)';
                                        }

                                        var px = 0;
                                        var isFirefox = navigator.userAgent.toLowerCase().indexOf('firefox') > -1;
                                        if (isFirefox) {
                                            px += 2 + Math.round(textNode.fontSize() / 20);
                                        }
                                        transform += 'translateY(-' + px + 'px)';

                                        textarea.style.transform = transform;

                                        // reset height
                                        textarea.style.height = 'auto';
                                        textarea.style.height = textarea.scrollHeight + 3 + 'px';

                                        textarea.focus();

                                        function removeTextarea() {
                                            textarea.parentNode.removeChild(textarea);
                                            window.removeEventListener('click', handleOutsideClick);
                                            textNode.show();

                                            layer.draw();
                                            updateTexture(stage);
                                        }

                                        function setTextareaWidth(newWidth) {
                                            if (!newWidth) {
                                                newWidth = textNode.placeholder.length * textNode.fontSize();
                                            }

                                            var isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
                                            var isFirefox = navigator.userAgent.toLowerCase().indexOf('firefox') > -1;
                                            if (isSafari || isFirefox) {
                                                newWidth = Math.ceil(newWidth);
                                            }

                                            var isEdge = document.documentMode || /Edge/.test(navigator.userAgent);
                                            if (isEdge) {
                                                newWidth += 1;
                                            }
                                            textarea.style.width = newWidth + 'px';
                                        }

                                        textarea.addEventListener('keydown', function(e) {
                                            if (e.keyCode === 13 && !e.shiftKey) {
                                                textNode.text(textarea.value);
                                                removeTextarea();
                                            }

                                            if (e.keyCode === 27) {
                                                removeTextarea();
                                            }
                                        });

                                        textarea.addEventListener('keydown', function(e) {
                                            let scale = textNode.getAbsoluteScale().x;
                                            setTextareaWidth(textNode.width() * scale);
                                            textarea.style.height = 'auto';
                                            textarea.style.height = textarea.scrollHeight + textNode.fontSize() + 'px';
                                        });

                                        function handleOutsideClick(e) {
                                            if (e.target !== textarea) {
                                                textNode.text(textarea.value);
                                                removeTextarea();
                                            }
                                        }
                                        setTimeout( () => {
                                            window.addEventListener('click', handleOutsideClick);
                                        }
                                        );
                                    }
                                    );
                                    // editing text end

                                    textNode.on('mousedown', function() {
                                        //prevent drawing
                                        stopDrawing();
                                    });

                                    textNode.on('transformstart dragmove transform transformend', function() {
                                        updateTexture(stage);
                                    });

                                    layer.add(textNode);
                                    layer.draw();
                                    updateTexture(stage);

                                    textNode.fire('click');
                                });
                            });

                            //font
                            textToolsNode.querySelectorAll('.cf_text-font').forEach(function(item) {
                                item.addEventListener('change', function() {
                                    let transformItems = getActiveTransformerItems();
                                    let activeText = null;
                                    if (transformItems.length > 0) {
                                        transformItems.forEach(function(itemNode) {
                                            if (itemNode.className == 'Text') {
                                                activeText = itemNode;
                                            }
                                        });
                                    }
                                    if (activeText) {
                                        let fontFamily = textToolsNode.querySelectorAll('.cf_text-font')[0].value;
                                        activeText.fontFamily(fontFamily);
                                        layer.draw();
                                        window.saveStateToHistory();
                                        updateTexture(stage);
                                    }
                                })
                            });

                            //brush color
                            textToolsNode.querySelectorAll('.cf_text-color').forEach(function(item) {
                                item.addEventListener('input', function() {
                                    Konva.ids[item.dataset.stage].cfTextConfig.fontColor = item.value;

                                    let transformItems = getActiveTransformerItems();
                                    let activeText = null;
                                    if (transformItems.length > 0) {
                                        transformItems.forEach(function(itemNode) {
                                            if (itemNode.className == 'Text') {
                                                activeText = itemNode;
                                            }
                                        });
                                    }
                                    if (activeText) {
                                        activeText.fill(item.value);
                                        layer.draw();
                                        window.saveStateToHistory();
                                        updateTexture(stage);
                                    }
                                })
                            });

                            //brush size
                            textToolsNode.querySelectorAll('.cf_text-size').forEach(function(item) {
                                item.addEventListener('input', function() {
                                    let fontSize = item.value;

                                    let localStage = Konva.ids[item.dataset.stage];
                                    localStage.cfTextConfig.fontSize = fontSize;

                                    let transformItems = getActiveTransformerItems();
                                    let activeText = null;
                                    if (transformItems.length > 0) {
                                        transformItems.forEach(function(itemNode) {
                                            if (itemNode.className == 'Text') {
                                                activeText = itemNode;
                                            }
                                        });
                                    }
                                    if (activeText) {
                                        activeText.fontSize(fontSize);
                                        layer.draw();
                                        window.saveStateToHistory();
                                        updateTexture(stage);
                                    }
                                })
                            });
                        }

                        // undo - redo extension (default)
                        if (true) {
                            //stage state history
                            var cfSavedState = null;
                            var cfStateNext = null;

                            function cfGetCurrentState() {
                                let savedItems = [];

                                layer.getChildren().forEach(function(item) {
                                    savedItems.push({
                                        className: item.className,
                                        attrs: item.attrs
                                    });
                                });

                                return savedItems;
                            }
                            function cfApplyState(state) {

                                //visual appearance
                                undoRedo.querySelector('.cf_state-redo').removeAttribute('disabled');
                                undoRedo.querySelector('.cf_state-undo').removeAttribute('disabled');
                                if (appHistoryStep >= appHistory.length - 1) {
                                    undoRedo.querySelector('.cf_state-redo').setAttribute('disabled', 'disabled');
                                }
                                if (appHistoryStep < 1) {
                                    undoRedo.querySelector('.cf_state-undo').setAttribute('disabled', 'disabled');
                                }
                                //visual appearance end

                                layer.destroyChildren();

                                state.forEach(function(item) {
                                    let newItem = new Konva[item.className];
                                    newItem.setAttrs(item.attrs);
                                    layer.add(newItem);
                                });

                                layer.draw();
                                updateTexture(stage);
                            }

                            var state = cfGetCurrentState();
                            var appHistory = [state];
                            window.appHistoryStep = 0;
                            //0 - fill; -1 - images

                            window.saveStateToHistory = function() {
                                state = cfGetCurrentState();
                                appHistory = appHistory.slice(0, appHistoryStep + 1);
                                appHistory = appHistory.concat([state]);
                                appHistoryStep += 1;

                                //undo redo next
                                if (false) {
                                    undoRedo.querySelector('.cf_state-undo').removeAttribute('disabled');
                                }
                            }
                            //initial state

                            let undoRedo = document.createElement('div');
                            undoRedo.className = 'cf_block cf_state-controls';

                            undoRedo.innerHTML = `
                            <button class="cf_button cf_state-reset">Reset</button>`;
                            toolsWrapper.append(undoRedo);

                            //undo redo next
                            if (false) {
                                undoRedo.innerHTML = `
                    <button class="cf_button cf_state-undo" disabled>Undo</button>
                    <button class="cf_button cf_state-redo" disabled>Redo</button>`;
                                toolsWrapper.append(undoRedo);

                                //undo
                                undoRedo.querySelector('.cf_state-undo').addEventListener('click', function() {

                                    if (appHistoryStep === 0) {
                                        return;
                                    }
                                    appHistoryStep -= 1;
                                    state = appHistory[appHistoryStep];
                                    cfApplyState(state);
                                });

                                //redo
                                undoRedo.querySelector('.cf_state-redo').addEventListener('click', function() {
                                    if (appHistoryStep === appHistory.length - 1) {
                                        return;
                                    }
                                    appHistoryStep += 1;

                                    state = appHistory[appHistoryStep];
                                    cfApplyState(state);
                                })
                            }

                            undoRedo.querySelector('.cf_state-reset').addEventListener('click', function() {
                                let toRemove = [];
                                layer.getChildren().forEach(function(item) {
                                    if (item.getName().includes('bg_') == false) {
                                        toRemove.push(item);
                                    }
                                });

                                toRemove.forEach(function(item) {
                                    item.destroy();
                                });
                                layer.draw();
                                updateTexture(stage);
                            });

                            //stage state history end
                        }

                    }
                    //konva extras end

                    $out = canvas;
                }

                return $out;
            }
            ).apply(null, arguments);
        }

        function cf_stageBackgroundLayerImage() {
            return ( (imageSrc, stage, layer, isWrapperLayer) => {
                if (isWrapperLayer != false) {
                    let konvaArea = stage.content;
                    konvaArea.style.backgroundImage = `url("${imageSrc}")`;
                    konvaArea.style.backgroundSize = "cover";
                } else {
                    if (stage) {
                        var imageObj = new Image();
                        imageObj.src = imageSrc;
                        imageObj.crossOrigin = "";
                        imageObj.onload = function() {

                            var background = new Konva.Image({
                                x: 0,
                                y: 0,
                                image: imageObj,
                                width: parseInt(stage.content.style.width.replace('px')),
                                height: parseInt(stage.content.style.height.replace('px')),
                                name: 'bg_image'
                            });

                            layer.add(background);
                            background.listening(false);
                            background.moveToBottom();
                            layer.draw();

                            if (window.saveStateToHistory) {
                                window.appHistoryStep = -1;
                                window.saveStateToHistory();
                            }
                            updateTexture(stage);
                        }
                        ;
                    }
                }
            }
            ).apply(null, arguments);
        }

        // replaceTexture puzzle
        function replaceTexture(matName, texName, texUrlOrElem, doCb) {

            const textures = PzLib.getMaterialEditableTextures(matName, true).filter(function(elem) {
                return elem.name == texName;
            });

            if (!textures.length)
                return;

            const mats = v3d.SceneUtils.getMaterialsByName(appInstance, matName);

            if (texUrlOrElem instanceof Promise) {

                texUrlOrElem.then(function(response) {
                    processImageUrl(response);
                }, function(error) {});

            } else if (typeof texUrlOrElem == 'string') {

                processImageUrl(texUrlOrElem);

                /**
     * NOTE: not checking for the PzLib.MediaHTML5 constructor, because otherwise this
     * puzzle would always provide the code that's not needed most of the time
     */
            } else if (texUrlOrElem instanceof Object && texUrlOrElem.source instanceof HTMLVideoElement) {

                processVideo(texUrlOrElem.source);

            } else if (texUrlOrElem instanceof HTMLCanvasElement) {

                processCanvas(texUrlOrElem);

            } else {

                return;

            }

            function processImageUrl(url) {

                const isHDR = (url.search(/\.hdr$/) > 0);
                const isComp = (url.search(/\.ktx2/) > 0);

                let isCompOld = false;
                let isVideoOld = false;
                textures.forEach(function(elem) {
                    if (elem.isCompressedTexture)
                        isCompOld = true;
                    if (elem.isVideoTexture)
                        isVideoOld = true;
                });

                let loader;

                if (!isHDR && !isComp && !isCompOld && !isVideoOld) {
                    loader = new v3d.ImageLoader();
                    loader.setCrossOrigin('Anonymous');
                } else if (isComp) {
                    loader = appInstance.loader.ktx2Loader;
                    loader.setCrossOrigin('Anonymous');
                } else if (isCompOld || isVideoOld) {
                    loader = new v3d.TextureLoader();
                    loader.setCrossOrigin('Anonymous');
                } else {
                    loader = new v3d.FileLoader();
                    loader.setResponseType('arraybuffer');
                }

                loader.load(url, function(loadedData) {

                    textures.forEach(function(elem) {

                        elem.dispose();

                        if (!isHDR && !isComp && !isCompOld && !isVideoOld) {

                            elem.image = loadedData;

                        } else if (isComp || isCompOld || isVideoOld) {

                            mats.forEach(function(mat) {
                                loadedData.flipY = false;
                                loadedData.name = texName;
                                PzLib.replaceMaterialEditableTexture(mat, elem, loadedData);
                                mat.needsUpdate = true;
                            });

                        } else {

                            // parse loaded HDR buffer
                            var rgbeLoader = new v3d.RGBELoader();
                            var texData = rgbeLoader.parse(loadedData);

                            elem.image = {
                                data: texData.data,
                                width: texData.width,
                                height: texData.height
                            }

                            elem.magFilter = v3d.LinearFilter;
                            elem.minFilter = v3d.LinearFilter;
                            elem.generateMipmaps = false;
                            elem.isDataTexture = true;
                        }

                        // update world material if it is using this texture
                        if (appInstance.scene !== null && appInstance.scene.worldMaterial !== null) {
                            var wMat = appInstance.scene.worldMaterial;
                            for (let texName in wMat.nodeTextures) {
                                if (wMat.nodeTextures[texName] == elem) {
                                    appInstance.updateEnvironment(wMat);
                                }
                            }
                        }
                    });

                    // exec once
                    doCb();

                });
            }

            function processVideo(elem) {
                const videoTex = new v3d.VideoTexture(elem);
                videoTex.flipY = false;
                videoTex.name = texName;

                let videoAssigned = false;

                var mats = v3d.SceneUtils.getMaterialsByName(appInstance, matName);
                mats.forEach(function(mat) {

                    textures.forEach(function(tex) {
                        PzLib.replaceMaterialEditableTexture(mat, tex, videoTex);
                    });

                    mat.needsUpdate = true;
                    // HACK: to assign new encoding in nodes, workaround for https://crbug.com/1256340
                    // HACK: preserve links to uniform arrays which got replaced in updateNodeGraph()
                    if (mat.isMeshNodeMaterial) {
                        const nodeRGBArrSave = mat.nodeRGBArr;
                        const nodeValueSave = mat.nodeValue;
                        mat.updateNodeGraph();
                        mat.nodeRGBArr = nodeRGBArrSave;
                        mat.nodeValue = nodeValueSave;
                    }

                    videoAssigned = true;
                });

                if (videoAssigned) {
                    if (elem.readyState < 1) {
                        PzLib.bindListener(elem, 'loadedmetadata', doCb);
                    } else {
                        doCb();
                    }
                }

            }

            function processCanvas(elem) {
                const canvasTex = new v3d.CanvasTexture(elem);
                canvasTex.flipY = false;
                canvasTex.name = texName;

                let canvasAssigned = false;

                var mats = v3d.SceneUtils.getMaterialsByName(appInstance, matName);
                mats.forEach(function(mat) {

                    textures.forEach(function(tex) {
                        PzLib.replaceMaterialEditableTexture(mat, tex, canvasTex);
                    });

                    mat.needsUpdate = true;
                    canvasAssigned = true;
                });

                if (canvasAssigned) {

                    if (PL) {
                        PL.canvasTextures = PL.canvasTextures || {};
                        PL.canvasTextures[canvasTex.image.id] = canvasTex;
                    }

                    doCb();
                }

            }
        }

        // createCSSRule puzzle
        function createCSSRule(cssRule, cssRuleCont, isParent, mediaRule) {
            var style = document.createElement('style');
            style.type = 'text/css';
            if (mediaRule) {
                style.innerHTML = `@media ${mediaRule} { ${cssRule} { ${cssRuleCont} } }`;
            } else {
                style.innerHTML = `${cssRule} { ${cssRuleCont} }`;
            }

            var styles = (isParent) ? parent.document.getElementsByTagName('head')[0] : document.getElementsByTagName('head')[0];
            styles.appendChild(style)
        }

        // setHTMLElemStyle puzzle
        function setHTMLElemStyle(prop, value, ids, isParent) {
            var elems = PzLib.getElements(ids, isParent);
            for (var i = 0; i < elems.length; i++) {
                var elem = elems[i];
                if (!elem || !elem.style)
                    continue;
                elem.style[prop] = value;
            }
        }

        // eventHTMLElem puzzle
        function eventHTMLElem(eventType, ids, isParent, callback) {
            var elems = PzLib.getElements(ids, isParent);
            for (var i = 0; i < elems.length; i++) {
                var elem = elems[i];
                if (!elem)
                    continue;

                PzLib.bindListener(elem, eventType, callback);
            }
        }

        // getHTMLElemAttribute puzzle
        function getHTMLElemAttribute(attr, id, isParent) {
            var elem = PzLib.getElement(id, isParent);
            return elem ? elem[attr] : '';
        }

        // setMaterialColor puzzle
        function setMaterialColor(matName, colName, r, g, b, cssCode) {

            var colors = PzLib.getMaterialEditableColors(matName);

            if (colors.indexOf(colName) < 0)
                return;

            if (cssCode) {
                var color = new v3d.Color(cssCode);
                r = color.r;
                g = color.g;
                b = color.b;
            }

            var mats = v3d.SceneUtils.getMaterialsByName(appInstance, matName);

            for (var i = 0; i < mats.length; i++) {
                var mat = mats[i];

                if (mat.isMeshNodeMaterial) {
                    var rgbIdx = mat.nodeRGBMap[colName];
                    mat.nodeRGB[rgbIdx].x = r;
                    mat.nodeRGB[rgbIdx].y = g;
                    mat.nodeRGB[rgbIdx].z = b;
                } else {
                    mat[colName].r = r;
                    mat[colName].g = g;
                    mat[colName].b = b;
                }
                mat.needsUpdate = true;

                if (appInstance.scene !== null) {
                    if (mat === appInstance.scene.worldMaterial) {
                        appInstance.updateEnvironment(mat);
                    }
                }
            }
        }

        // show and hide puzzles
        function changeVis(objSelector, bool) {
            var objNames = PzLib.retrieveObjectNames(objSelector);

            for (var i = 0; i < objNames.length; i++) {
                var objName = objNames[i]
                if (!objName)
                    continue;
                var obj = PzLib.getObjectByName(objName);
                if (!obj)
                    continue;
                obj.visible = bool;
                obj.resolveMultiMaterial().forEach(function(objR) {
                    objR.visible = bool;
                });
            }
        }

        // downloadFile puzzle
        function downloadFile(contents, filename) {
            if (!filename)
                return;

            if (contents instanceof Promise) {

                contents.then(function(response) {

                    doDownload(response, filename);

                }, function(error) {});

            } else {

                doDownload(contents, filename);

            }

            function doDownload(contents, filename) {
                if (typeof contents !== 'string') {
                    contents = PzLib.convertObjToJsonDataUrl(contents);
                } else if (!PzLib.isDataUrl(contents) && !PzLib.isBlobUrl(contents)) {
                    contents = PzLib.convertObjToTextDataUrl(contents);
                }

                const link = document.createElement('a');
                link.href = contents;
                link.download = filename;
                document.body.appendChild(link);
                link.click();
                setTimeout( () => {
                    document.body.removeChild(link);
                }
                , 100);
            }
        }

        // exportToGLTF puzzle
        function exportToGLTF(objSelector, onlyVisible, exportAnims, binary) {

            if (objSelector === '' || objSelector === PzLib.LIST_NONE) {

                var objs = [appInstance.scene];

            } else {

                var objs = PzLib.retrieveObjectNames(objSelector).map(function(objName) {
                    return PzLib.getObjectByName(objName);
                });

            }

            if (objs.length) {

                var gltfExporter = new v3d.GLTFExporter();

                var clips = [];

                if (exportAnims) {
                    for (var i = 0; i < appInstance.actions.length; i++) {
                        var clip = appInstance.actions[i].getClip();
                        if (clips.indexOf(clip) == -1)
                            clips.push(clip);
                    }
                }

                var options = {
                    onlyVisible: onlyVisible,
                    binary: binary,
                    trs: true,
                    animations: clips
                }

                return new Promise(function(resolve, reject) {

                    gltfExporter.parse(objs, function(result) {

                        var dataUrl;

                        if (result instanceof ArrayBuffer) {

                            dataUrl = URL.createObjectURL(new Blob([result],{
                                type: 'application/octet-stream'
                            }));

                        } else {

                            dataUrl = PzLib.convertObjToJsonDataUrl(result, 'model/gltf+json');

                        }

                        resolve(dataUrl);

                    }, function(error) {

                        reject(error);

                    }, options);

                }
                );

            }
            ;

        }

        // Describe this function...
        function create_bg_canvas() {
            if (getHTMLElemAttribute('innerHTML', 'myClass2', false) == '') {
                mydrawer3 = cf_drawInit(['QUERYSELECTOR', '#myClass2'], "left", 400, 400, 4, '{"add_draw_mode":true,"add_drawing_tools_mode":true,"add_image_upload_mode":true,"add_transform_mode":true,"add_text_mode":true}', (stage, layer, isWrapperLayer=false) => {
                    try {
                        cf_stageBackgroundLayerImage('none.png', stage, layer, isWrapperLayer)
                    } catch (ex) {}
                }
                , (stage, layer, isWrapperLayer=false) => {
                    try {
                        cf_stageBackgroundLayerImage('background.jpg', stage, layer, isWrapperLayer)
                    } catch (ex) {}
                }
                );
                replaceTexture('camera_bg', 'clouds.jpg', mydrawer3, function() {});
            }
        }

        // setHTMLElemAttribute puzzle
        function setHTMLElemAttribute(attr, value, ids, isParent) {
            var elems = PzLib.getElements(ids, isParent);
            for (var i = 0; i < elems.length; i++) {
                var elem = elems[i];
                if (!elem)
                    continue;

                if ((attr == 'href' || attr == 'src') && value instanceof Promise) {
                    // resolve promise value for url-based attributes
                    value.then(function(response) {
                        elem[attr] = response;
                    });
                } else {
                    elem[attr] = value;
                }
            }
        }

        // Describe this function...
        function remove_bg_canvas() {
            setHTMLElemAttribute('innerHTML', '', 'myClass2', false);
        }

        // setActiveCamera puzzle
        function setActiveCamera(camName) {
            var camera = PzLib.getObjectByName(camName);
            if (!camera || !camera.isCamera || appInstance.getCamera() == camera)
                return;
            appInstance.setCamera(camera);
        }

        // Describe this function...
        function dispatchEvent(eventName, valuesObject) {
            var VARS = Object.defineProperties({}, {
                'myDrawer2': {
                    get: function() {
                        return myDrawer2;
                    },
                    set: function(val) {
                        myDrawer2 = val;
                    }
                },
                'openuv': {
                    get: function() {
                        return openuv;
                    },
                    set: function(val) {
                        openuv = val;
                    }
                },
                'openuv2': {
                    get: function() {
                        return openuv2;
                    },
                    set: function(val) {
                        openuv2 = val;
                    }
                },
                'value': {
                    get: function() {
                        return value;
                    },
                    set: function(val) {
                        value = val;
                    }
                },
                'camera_bgs': {
                    get: function() {
                        return camera_bgs;
                    },
                    set: function(val) {
                        camera_bgs = val;
                    }
                },
                'mydrawer3': {
                    get: function() {
                        return mydrawer3;
                    },
                    set: function(val) {
                        mydrawer3 = val;
                    }
                },
                'imagebg': {
                    get: function() {
                        return imagebg;
                    },
                    set: function(val) {
                        imagebg = val;
                    }
                },
                'tshirts': {
                    get: function() {
                        return tshirts;
                    },
                    set: function(val) {
                        tshirts = val;
                    }
                },
                'anims': {
                    get: function() {
                        return anims;
                    },
                    set: function(val) {
                        anims = val;
                    }
                },
                'eventName': {
                    get: function() {
                        return eventName;
                    },
                    set: function(val) {
                        eventName = val;
                    }
                },
                'valuesObject': {
                    get: function() {
                        return valuesObject;
                    },
                    set: function(val) {
                        valuesObject = val;
                    }
                },
            });

            Function('app', 'v3d', 'puzzles', 'VARS', 'PROC', (('window.top.dispatchEvent(new CustomEvent(VARS[\'eventName\'], { detail: VARS[\'valuesObject\'] || {} }));' + '\n' + '')))(appInstance, v3d, PL, VARS, PROC);

        }

        // setMaterialValue puzzle
        function setMaterialValue(matName, valName, value) {

            var values = PzLib.getMaterialEditableValues(matName);
            if (values.indexOf(valName) < 0)
                return;

            var mats = v3d.SceneUtils.getMaterialsByName(appInstance, matName);

            for (var i = 0; i < mats.length; i++) {
                var mat = mats[i];

                if (mat.isMeshNodeMaterial) {
                    var valIdx = mat.nodeValueMap[valName];
                    mat.nodeValue[valIdx] = Number(value);
                } else
                    mat[valName] = Number(value);

                if (appInstance.scene !== null) {
                    if (mat === appInstance.scene.worldMaterial) {
                        appInstance.updateEnvironment(mat);
                    }
                }
            }
        }

        /* Model Entrance Animation */

        operateAnimation('PLAY', 'tshirt_pivot', null, null, 'LoopOnce', 1, function() {}, false);

        myDrawer2 = cf_drawInit(['QUERYSELECTOR', '#myClass'], "left", 400, 400, 4, '{"add_draw_mode":true,"add_drawing_tools_mode":true,"add_image_upload_mode":true,"add_transform_mode":true,"add_text_mode":true}', (stage, layer, isWrapperLayer=false) => {
            try {
                cf_stageBackgroundLayerImage('none.png', stage, layer, isWrapperLayer)
            } catch (ex) {}
        }
        , (stage, layer, isWrapperLayer=false) => {
            try {
                cf_stageBackgroundLayerImage('placementguide.jpg', stage, layer, isWrapperLayer)
            } catch (ex) {}
        }
        );
        replaceTexture('Base', 'yourdesignhere.png.001', myDrawer2, function() {});
        createCSSRule('#myClass', "position: absolute; bottom: 0; right: 0;", false, '');

        /* Controlling Whether Image uploaded should be on background or garment */
        openuv = false;
        setHTMLElemStyle('display', 'none', 'myClass', false);
        eventHTMLElem('click', 'upload_design', true, function(event) {
            setHTMLElemStyle('display', 'none', 'myClass2', false);
            openuv2 = false;
            if (openuv == false) {
                setHTMLElemStyle('display', 'block', 'myClass', false);
                openuv = true;
            } else {
                setHTMLElemStyle('display', 'none', 'myClass', false);
                openuv = false;
            }
        });

        eventHTMLElem('input', 'color-changer', true, function(event) {
            value = getHTMLElemAttribute('value', 'color-changer', true);
            setMaterialColor('Base', 'RGB', 0, 0, 0, value);
        });

        eventHTMLElem('input', 'color-changer1', true, function(event) {
            remove_bg_canvas();
            changeVis(camera_bgs, false);
            openuv2 = false;
            setHTMLElemStyle('display', 'none', 'myClass2', false);
            value = getHTMLElemAttribute('value', 'color-changer1', true);
            setMaterialColor('env_sphere', 'RGB', 0, 0, 0, value);
        });

        /* Image Export/Screenshot */
        eventHTMLElem('click', 'exportimage', true, function(event) {
            downloadFile(appInstance.renderer.domElement.toDataURL('image/png'), 'MoxFlow.png');
        });

        /* 3D Model Export */
        changeVis('3Dmodelexport', false);
        eventHTMLElem('click', 'exportmodel', true, function(event) {
            changeVis('3Dmodelexport', true);
            replaceTexture('susannas_help_PBR', 'yourdesignhere_001.png', myDrawer2, function() {});
            downloadFile(exportToGLTF('3Dmodelexport', true, false, false), '3d_Model.gltf');
            replaceTexture('Base', 'yourdesignhere.png.001', myDrawer2, function() {});
            changeVis('3Dmodelexport', false);
        });

        /* The Video Export function can be found in tshirt-sizing.js */

        /* OPENING 3D BACKGROUND */
        eventHTMLElem('click', '3Dbackground', true, function(event) {
            imagebg = 'inactive';
            changeVis(camera_bgs, false);
            openuv2 = false;
            setHTMLElemStyle('display', 'none', 'myClass2', false);
        });

        /* CHANGING THE COLOR OF ALL BACKGROUNDS */
        eventHTMLElem('input', 'color-changer1', true, function(event) {
            value = getHTMLElemAttribute('value', 'color-changer1', true);
            setMaterialColor('camera_bg', 'RGB', 0, 0, 0, value);
        });

        mydrawer3 = null;

        createCSSRule('#myClass2', "position: absolute; bottom: 0; right: 0;", false, '');

        /* UPLOADING USER IMAGE TO BACKGROUND */

        /* Controlling Whether Image uploaded should be on background or garment */
        openuv2 = false;
        setHTMLElemStyle('display', 'none', 'myClass2', false);
        eventHTMLElem('click', 'backgroundimage', true, function(event) {
            setHTMLElemStyle('display', 'none', 'myClass', false);
            openuv = false;
            if (openuv2 == false) {
                create_bg_canvas();
                setHTMLElemStyle('display', 'block', 'myClass2', false);
                openuv2 = true;
            } else {
                setHTMLElemStyle('display', 'none', 'myClass2', false);
                openuv2 = false;
            }
        });
        eventHTMLElem('click', 'resetbg', true, function(event) {
            changeVis('cameradefault_bg', false);
            changeVis('camrotate_bg', false);
            changeVis('camrotatezoom_bg', false);
            remove_bg_canvas();
            setHTMLElemStyle('display', 'none', 'myClass2', false);
            openuv2 = false;
        });

        /* THIS IS FOR HIDING BACKGROUNDS WHEN APP OPENS */
        changeVis('camrotatezoom_bg', false);
        changeVis('camrotate_bg', false);
        changeVis('cameradefault_bg', false);

        imagebg = 'inactive';
        eventHTMLElem('click', 'backgroundimage', true, function(event) {
            imagebg = 'active';
            setActiveCamera('cameradefault');
            changeVis('cameradefault_bg', true);
        });

        /* CONTROLLING WHICH BACKGROUND PLANE TO REVEAL */
        eventHTMLElem('click', 'camerarotationzoon', true, function(event) {
            if (imagebg == 'active') {
                changeVis('cameradefault_bg', false);
                changeVis('camrotatezoom_bg', false);
                changeVis('camrotate_bg', true);
            }
        });
        eventHTMLElem('click', 'camerarotation', true, function(event) {
            if (imagebg == 'active') {
                changeVis('cameradefault_bg', false);
                changeVis('camrotate_bg', false);
                changeVis('camrotatezoom_bg', true);
            }
        });
        eventHTMLElem('click', 'cameranone', true, function(event) {
            if (imagebg == 'active') {
                changeVis('camrotate_bg', false);
                changeVis('camrotatezoom_bg', false);
                changeVis('cameradefault_bg', true);
            }
        });

        tshirts = ['tshirt_walking', 'tshirt_waves', 'tshirt_static'];
        changeVis(tshirts, false);
        changeVis('tshirt_static', true);

        anims = ['tshirt_walking', 'tshirt_waves'];

        operateAnimation('PAUSE', anims, null, null, 'AUTO', 1, function() {}, false);

        eventHTMLElem('click', 'walkinganimation', true, function(event) {

            operateAnimation('PAUSE', anims, null, null, 'AUTO', 1, function() {}, false);

            operateAnimation('PLAY', 'tshirt_walking', 1, 16, 'AUTO', 0.3, function() {}, false);

            replaceTexture('Base', 'ao_tshirt_outside.jpg', 'walkingambient.jpg', function() {});
            changeVis(tshirts, false);
            changeVis('tshirt_walking', true);
        });
        eventHTMLElem('click', 'windanimation', true, function(event) {

            operateAnimation('PAUSE', anims, null, null, 'AUTO', 1, function() {}, false);

            operateAnimation('PLAY', 'tshirt_waves', 0, 20, 'AUTO', 0.2, function() {}, false);

            replaceTexture('Base', 'ao_tshirt_outside.jpg', 'ao_tshirt_outside.jpg', function() {});
            changeVis(tshirts, false);
            changeVis('tshirt_waves', true);
        });
        eventHTMLElem('click', 'noanimation', true, function(event) {

            operateAnimation('PAUSE', anims, null, null, 'AUTO', 1, function() {}, false);

            operateAnimation('SET_FRAME', 'tshirt_waves', 0, null, 'AUTO', 1, function() {}, false);

            replaceTexture('Base', 'ao_tshirt_outside.jpg', 'ao_tshirt_outside.jpg', function() {});
            changeVis(tshirts, false);
            changeVis('tshirt_static', true);
        });

        eventHTMLElem('input', 'slider-single', true, function(event) {

            operateAnimation('SET_SPEED', 'tshirt_walking', null, null, 'AUTO', getHTMLElemAttribute('value', 'slider-single', true), function() {}, false);

            operateAnimation('SET_SPEED', 'tshirt_waves', null, null, 'AUTO', getHTMLElemAttribute('value', 'slider-single', true), function() {}, false);

        });

        setActiveCamera('cameradefault');

        operateAnimation('STOP', 'camrotatezoomaxis', null, null, 'AUTO', 1, function() {}, false);

        operateAnimation('STOP', 'camrotateaxis', null, null, 'AUTO', 1, function() {}, false);

        eventHTMLElem('click', 'camerarotationzoon', true, function(event) {

            operateAnimation('STOP', 'camrotatezoom', null, null, 'AUTO', 1, function() {}, false);

            operateAnimation('STOP', 'camrotatezoomaxis', null, null, 'AUTO', 1, function() {}, false);

            setActiveCamera('camrotate');

            operateAnimation('PLAY', 'camrotateaxis', null, null, 'AUTO', 1, function() {}, false);

        });
        eventHTMLElem('click', 'camerarotation', true, function(event) {

            operateAnimation('STOP', 'camrotateaxis', null, null, 'AUTO', 1, function() {}, false);

            setActiveCamera('camrotatezoom');

            operateAnimation('PLAY', 'camrotatezoomaxis', null, null, 'AUTO', 1, function() {}, false);

            operateAnimation('PLAY', 'camrotatezoom', null, null, 'AUTO', 1, function() {}, false);

        });
        eventHTMLElem('click', 'cameranone', true, function(event) {

            operateAnimation('STOP', 'camrotatezoom', null, null, 'AUTO', 1, function() {}, false);

            operateAnimation('STOP', 'camrotateaxis', null, null, 'AUTO', 1, function() {}, false);

            operateAnimation('STOP', 'camrotatezoomaxis', null, null, 'AUTO', 1, function() {}, false);

            setActiveCamera('cameradefault');
        });

        /* Set Puff Print and Acid Wash to NONE */
        setMaterialValue('Base', 'Value.003', 0);
        setMaterialValue('Base', 'Value.004', 0);

        /* Puff Print Slider */
        eventHTMLElem('input', 'slider-single-2', true, function(event) {
            setMaterialValue('Base', 'Value.003', getHTMLElemAttribute('value', 'slider-single-2', true));
        });

        /* Acid Wash Slider */
        eventHTMLElem('input', 'slider-single-3', true, function(event) {
            setMaterialValue('Base', 'Value.004', getHTMLElemAttribute('value', 'slider-single-3', true));
        });

    }
    // end of PL.init function

    PL.disposeListeners = function() {
        if (_pGlob) {
            _pGlob.eventListeners.forEach( ({target, type, listener, optionsOrUseCapture}) => {
                target.removeEventListener(type, listener, optionsOrUseCapture);
            }
            );
            _pGlob.eventListeners.length = 0;
        }
    }

    PL.disposeHTMLElements = function() {
        if (_pGlob) {
            _pGlob.htmlElements.forEach(elem => {
                elem.remove();
            }
            );
            _pGlob.htmlElements.clear();
        }
    }

    PL.disposeMaterialsCache = function() {
        if (_pGlob) {
            for (const mat of _pGlob.materialsCache.values()) {
                mat.dispose();
            }
            _pGlob.materialsCache.clear();
        }
    }

    PL.dispose = function() {
        PL.disposeListeners();
        PL.disposeHTMLElements();
        PL.disposeMaterialsCache();
        _pGlob = null;
        // backward compatibility
        if (v3d[Symbol.toStringTag] !== 'Module') {
            delete v3d.PL;
            delete v3d.puzzles;
        }
    }

    return PL;

}

export {createPL};
