// Editor-side state and history management.
var beepbox;
(function (beepbox) {
    var ChangeNotifier = (function () {
        function ChangeNotifier() {
            this._watchers = [];
            this._dirty = false;
        }
        ChangeNotifier.prototype.watch = function (watcher) {
            if (this._watchers.indexOf(watcher) == -1) {
                this._watchers.push(watcher);
            }
        };
        ChangeNotifier.prototype.unwatch = function (watcher) {
            var index = this._watchers.indexOf(watcher);
            if (index != -1) {
                this._watchers.splice(index, 1);
            }
        };
        ChangeNotifier.prototype.changed = function () {
            this._dirty = true;
        };
        ChangeNotifier.prototype.notifyWatchers = function () {
            if (!this._dirty)
                return;
            this._dirty = false;
            for (var _i = 0, _a = this._watchers.concat(); _i < _a.length; _i++) {
                var watcher = _a[_i];
                watcher();
            }
        };
        return ChangeNotifier;
    }());
    beepbox.ChangeNotifier = ChangeNotifier;
})(beepbox || (beepbox = {}));
// Song document wrapper around history, preferences, and current selection.
var beepbox;
(function (beepbox) {
    var SongDocument = (function () {
        function SongDocument(string) {
            var _this = this;
            this.notifier = new beepbox.ChangeNotifier();
            this.channel = 0;
            this.bar = 0;
            this.volume = 75;
            this.trackVisibleBars = 16;
            this.barScrollPos = 0;
            this.prompt = null;
            this._recentChange = null;
            this._sequenceNumber = 0;
            this._barFromCurrentState = 0;
            this._channelFromCurrentState = 0;
            this._shouldPushState = false;
            this._waitingToUpdateState = false;
            this._whenHistoryStateChanged = function () {
                var state = window.history.state;
                if (state && state.sequenceNumber == _this._sequenceNumber)
                    return;
                if (state == null) {
                    _this._sequenceNumber++;
                    state = { canUndo: true, sequenceNumber: _this._sequenceNumber, bar: _this.bar, channel: _this.channel, prompt: _this.prompt };
                    new beepbox.ChangeSong(_this, location.hash);
                    window.history.replaceState(state, "", "#" + _this.song.toBase64String());
                }
                else {
                    if (state.sequenceNumber == _this._sequenceNumber - 1) {
                        _this.bar = _this._barFromCurrentState;
                        _this.channel = _this._channelFromCurrentState;
                    }
                    else if (state.sequenceNumber != _this._sequenceNumber) {
                        _this.bar = state.bar;
                        _this.channel = state.channel;
                    }
                    _this._sequenceNumber = state.sequenceNumber;
                    _this.prompt = state.prompt;
                    new beepbox.ChangeSong(_this, location.hash);
                }
                _this._barFromCurrentState = state.bar;
                _this._channelFromCurrentState = state.channel;
                _this.forgetLastChange();
                _this.notifier.notifyWatchers();
            };
            this._cleanDocument = function () {
                _this.notifier.notifyWatchers();
            };
            this._updateHistoryState = function () {
                _this._waitingToUpdateState = false;
                var hash = "#" + _this.song.toBase64String();
                var state;
                if (_this._shouldPushState) {
                    _this._sequenceNumber++;
                    state = { canUndo: true, sequenceNumber: _this._sequenceNumber, bar: _this.bar, channel: _this.channel, prompt: _this.prompt };
                    window.history.pushState(state, "", hash);
                }
                else {
                    state = { canUndo: true, sequenceNumber: _this._sequenceNumber, bar: _this.bar, channel: _this.channel, prompt: _this.prompt };
                    window.history.replaceState(state, "", hash);
                }
                _this._barFromCurrentState = state.bar;
                _this._channelFromCurrentState = state.channel;
                _this._shouldPushState = false;
            };
            this.song = new beepbox.Song(string);
            this.synth = new beepbox.Synth(this.song);
            this.autoPlay = localStorage.getItem("autoPlay") == "true";
            this.autoFollow = localStorage.getItem("autoFollow") == "true";
            this.showFifth = localStorage.getItem("showFifth") == "true";
			this.showAdvancedColors = localStorage.getItem("showMore") == "true";
            this.showLetters = localStorage.getItem("showLetters") == "true";
            this.showChannels = localStorage.getItem("showChannels") == "true";
            this.showScrollBar = localStorage.getItem("showScrollBar") == "true";
			this.showChannelVolume = localStorage.getItem("showVolumeBar") == "true";
			this.showAdvancedSettings = localStorage.getItem("advancedSettings") == "true" || localStorage.getItem("advancedSettings") == null;
            Object.defineProperty(this, "showMore", {
                get: function () { return this.showAdvancedColors; },
                set: function (value) { this.showAdvancedColors = value; },
                configurable: true,
                enumerable: true,
            });
            Object.defineProperty(this, "showVolumeBar", {
                get: function () { return this.showChannelVolume; },
                set: function (value) { this.showChannelVolume = value; },
                configurable: true,
                enumerable: true,
            });
            Object.defineProperty(this, "advancedSettings", {
                get: function () { return this.showAdvancedSettings; },
                set: function (value) { this.showAdvancedSettings = value; },
                configurable: true,
                enumerable: true,
            });
			if (localStorage.getItem("volume") != null)
                this.volume = Number(localStorage.getItem("volume"));
            this.synth.volume = this._calcVolume();
            var state = window.history.state;
            if (state == null) {
                state = { canUndo: false, sequenceNumber: 0, bar: 0, channel: 0, prompt: null };
                window.history.replaceState(state, "", "#" + this.song.toBase64String());
            }
            window.addEventListener("hashchange", this._whenHistoryStateChanged);
            window.addEventListener("popstate", this._whenHistoryStateChanged);
            this.bar = state.bar;
            this.channel = state.channel;
            this._barFromCurrentState = state.bar;
            this._channelFromCurrentState = state.channel;
            this.barScrollPos = Math.max(0, this.bar - (this.trackVisibleBars - 6));
            this.prompt = state.prompt;
            for (var _i = 0, _a = ["input", "change", "click", "keyup", "keydown", "mousedown", "mousemove", "mouseup", "touchstart", "touchmove", "touchend", "touchcancel"]; _i < _a.length; _i++) {
                var eventName = _a[_i];
                window.addEventListener(eventName, this._cleanDocument);
            }
        }
        SongDocument.prototype.record = function (change, replaceState) {
            if (replaceState === void 0) { replaceState = false; }
            if (change.isNoop()) {
                this._recentChange = null;
                if (replaceState) {
                    window.history.back();
                }
            }
            else {
                this._recentChange = change;
                if (!replaceState) {
                    this._shouldPushState = true;
                }
                if (!this._waitingToUpdateState) {
                    window.requestAnimationFrame(this._updateHistoryState);
                    this._waitingToUpdateState = true;
                }
            }
        };
        SongDocument.prototype.openPrompt = function (prompt) {
            this.prompt = prompt;
            var hash = "#" + this.song.toBase64String();
            this._sequenceNumber++;
            var state = { canUndo: true, sequenceNumber: this._sequenceNumber, bar: this.bar, channel: this.channel, prompt: this.prompt };
            window.history.pushState(state, "", hash);
        };
        SongDocument.prototype.undo = function () {
            var state = window.history.state;
            if (state.canUndo)
                window.history.back();
        };
        SongDocument.prototype.redo = function () {
            window.history.forward();
        };
        SongDocument.prototype.setProspectiveChange = function (change) {
            this._recentChange = change;
        };
        SongDocument.prototype.forgetLastChange = function () {
            this._recentChange = null;
        };
        SongDocument.prototype.lastChangeWas = function (change) {
            return change != null && change == this._recentChange;
        };
        SongDocument.prototype.savePreferences = function () {
            localStorage.setItem("autoPlay", this.autoPlay ? "true" : "false");
            localStorage.setItem("autoFollow", this.autoFollow ? "true" : "false");
            localStorage.setItem("showFifth", this.showFifth ? "true" : "false");
			localStorage.setItem("showMore", this.showAdvancedColors ? "true" : "false");
            localStorage.setItem("showLetters", this.showLetters ? "true" : "false");
            localStorage.setItem("showChannels", this.showChannels ? "true" : "false");
            localStorage.setItem("showScrollBar", this.showScrollBar ? "true" : "false");
			localStorage.setItem("showVolumeBar", this.showChannelVolume ? "true" : "false");
			localStorage.setItem("advancedSettings", this.showAdvancedSettings ? "true" : "false");
            localStorage.setItem("volume", String(this.volume));
        };
        SongDocument.prototype.setVolume = function (val) {
            this.volume = val;
            this.savePreferences();
            this.synth.volume = this._calcVolume();
        };
        SongDocument.prototype._calcVolume = function () {
            return Math.min(1.0, Math.pow(this.volume / 50.0, 0.5)) * Math.pow(2.0, (this.volume - 75.0) / 25.0);
        };
        SongDocument.prototype.getCurrentPattern = function () {
            return this.song.getPattern(this.channel, this.bar);
        };
        SongDocument.prototype.getCurrentInstrument = function () {
            var pattern = this.getCurrentPattern();
            return pattern == null ? 0 : pattern.instrument;
        };
        return SongDocument;
    }());
    SongDocument._latestVersion = 2;
    beepbox.SongDocument = SongDocument;
})(beepbox || (beepbox = {}));
// Lightweight DOM and SVG construction helpers used throughout the editor UI.
var beepbox;
(function (beepbox) {
    var html;
    (function (html) {
        function element(type, attributes, children) {
            var elem = document.createElement(type);
            if (attributes)
                for (var _i = 0, _a = Object.keys(attributes); _i < _a.length; _i++) {
                    var key = _a[_i];
                    if (key == "style")
                        elem.setAttribute(key, attributes[key]);
                    else
                        elem[key] = attributes[key];
                }
            if (children)
                for (var _b = 0, children_1 = children; _b < children_1.length; _b++) {
                    var child = children_1[_b];
                    elem.appendChild(child);
                }
            return elem;
        }
        html.element = element;
        function button(attributes, children) {
            return element("button", attributes, children);
        }
        html.button = button;
        function div(attributes, children) {
            return element("div", attributes, children);
        }
        html.div = div;
        function span(attributes, children) {
            return element("span", attributes, children);
        }
        html.span = span;
        function select(attributes, children) {
            return element("select", attributes, children);
        }
        html.select = select;
        function option(value, display, selected, disabled) {
            if (selected === void 0) { selected = false; }
            if (disabled === void 0) { disabled = false; }
            var o = document.createElement("option");
            o.value = value;
            o.selected = selected;
            o.disabled = disabled;
            o.appendChild(text(display));
            return o;
        }
        html.option = option;
        function canvas(attributes) {
            return element("canvas", attributes);
        }
        html.canvas = canvas;
        function input(attributes) {
            return element("input", attributes);
        }
        html.input = input;
        function br() {
            return element("br");
        }
        html.br = br;
        function text(content) {
            return document.createTextNode(content);
        }
        html.text = text;
    })(html = beepbox.html || (beepbox.html = {}));
    var svgNS = "http://www.w3.org/2000/svg";
    function svgElement(type, attributes, children) {
        var elem = document.createElementNS(svgNS, type);
        if (attributes)
            for (var _i = 0, _a = Object.keys(attributes); _i < _a.length; _i++) {
                var key = _a[_i];
                elem.setAttribute(key, attributes[key]);
            }
        if (children)
            for (var _b = 0, children_2 = children; _b < children_2.length; _b++) {
                var child = children_2[_b];
                elem.appendChild(child);
            }
        return elem;
    }
    beepbox.svgElement = svgElement;
})(beepbox || (beepbox = {}));
// Editor stylesheet recovered from the compiled build, plus reconstructed fixes.
var beepbox;
(function (beepbox) {
    var styleSheet = document.createElement('style');
    styleSheet.type = "text/css";
    styleSheet.appendChild(document.createTextNode("\n\n.beepboxEditor {\n\tdisplay: flex;\n\t-webkit-touch-callout: none;\n\t-webkit-user-select: none;\n\t-khtml-user-select: none;\n\t-moz-user-select: none;\n\t-ms-user-select: none;\n\tuser-select: none;\n\tposition: relative;\n\ttouch-action: manipulation;\n\tcursor: default;\n\tfont-size: small;\n\toverflow: hidden;\n}\n\n.beepboxEditor div {\n\tmargin: 0;\n\tpadding: 0;\n}\n\n.beepboxEditor .promptContainer {\n\tposition: absolute;\n\ttop: 0;\n\tleft: 0;\n\twidth: 100%;\n\theight: 100%;\n\tbackground: rgba(0,0,0,0.5);\n\tdisplay: flex;\n\tjustify-content: center;\n\talign-items: center;\n}\n\n.beepboxEditor .prompt {\n\tmargin: auto;\n\ttext-align: center;\n\tbackground: #000;\n\tborder-radius: 15px;\n\tborder: 4px solid #444;\n\tcolor: #fff;\n\tpadding: 20px;\n\tdisplay: flex;\n\tflex-direction: column;\n}\n\n.beepboxEditor .prompt > *:not(:first-child) {\n\tmargin-top: 1.5em;\n}\n\n/* Use psuedo-elements to add cross-browser up & down arrows to select elements: */\n.beepboxEditor .selectContainer {\n\tposition: relative;\n}\n.beepboxEditor .selectContainer:not(.menu)::before {\n\tcontent: \"\";\n\tposition: absolute;\n\tright: 0.3em;\n\ttop: 0.4em;\n\tborder-bottom: 0.4em solid currentColor;\n\tborder-left: 0.3em solid transparent;\n\tborder-right: 0.3em solid transparent;\n\tpointer-events: none;\n}\n.beepboxEditor .selectContainer:not(.menu)::after {\n\tcontent: \"\";\n\tposition: absolute;\n\tright: 0.3em;\n\tbottom: 0.4em;\n\tborder-top: 0.4em solid currentColor;\n\tborder-left: 0.3em solid transparent;\n\tborder-right: 0.3em solid transparent;\n\tpointer-events: none;\n}\n.beepboxEditor .selectContainer.menu::after {\n\tcontent: \"\";\n\tposition: absolute;\n\tright: 0.7em;\n\tmargin: auto;\n\ttop: 0;\n\tbottom: 0;\n\theight: 0;\n\tborder-top: 0.4em solid currentColor;\n\tborder-left: 0.3em solid transparent;\n\tborder-right: 0.3em solid transparent;\n\tpointer-events: none;\n}\n.beepboxEditor select {\n\tmargin: 0;\n\tpadding: 0 0.3em;\n\tdisplay: block;\n\theight: 2em;\n\tborder: none;\n\tborder-radius: 0.4em;\n\tbackground: #363636;\n\tcolor: inherit;\n\tfont-size: inherit;\n\tcursor: pointer;\n\tfont-family: inherit;\n\n\t-webkit-appearance:none;\n\t-moz-appearance: none;\n\tappearance: none;\n}\n.beepboxEditor .menu select {\n\tpadding: 0 2em;\n}\n.beepboxEditor select:focus {\n\tbackground: #565656;\n\toutline: none;\n}\n.beepboxEditor .menu select {\n\ttext-align: center;\n\ttext-align-last: center;\n}\n\n/* This makes it look better in firefox on my computer... What about others?\n@-moz-document url-prefix() {\n\t.beepboxEditor select { padding: 0 2px; }\n}\n*/\n.beepboxEditor button {\n\tmargin: 0;\n\tposition: relative;\n\theight: 2em;\n\tborder: none;\n\tborder-radius: 0.4em;\n\tbackground: #363636;\n\tcolor: inherit;\n\tfont-size: inherit;\n\tfont-family: inherit;\n\tcursor: pointer;\n}\n.beepboxEditor button:focus {\n\tbackground: #565656;\n\toutline: none;\n}\n.beepboxEditor button.playButton, .beepboxEditor button.pauseButton {\n\tpadding-left: 2em;\n}\n.beepboxEditor button.playButton::before {\n\tcontent: \"\";\n\tposition: absolute;\n\tleft: 0.7em;\n\ttop: 50%;\n\tmargin-top: -0.65em;\n\tborder-left: 1em solid currentColor;\n\tborder-top: 0.65em solid transparent;\n\tborder-bottom: 0.65em solid transparent;\n\tpointer-events: none;\n}\n.beepboxEditor button.pauseButton::before {\n\tcontent: \"\";\n\tposition: absolute;\n\tleft: 0.7em;\n\ttop: 50%;\n\tmargin-top: -0.65em;\n\twidth: 0.3em;\n\theight: 1.3em;\n\tbackground: currentColor;\n\tpointer-events: none;\n}\n.beepboxEditor button.pauseButton::after {\n\tcontent: \"\";\n\tposition: absolute;\n\tleft: 1.4em;\n\ttop: 50%;\n\tmargin-top: -0.65em;\n\twidth: 0.3em;\n\theight: 1.3em;\n\tbackground: currentColor;\n\tpointer-events: none;\n}\n\n.beepboxEditor button.prevBarButton::before {\n\tcontent: \"\";\n\tposition: absolute;\n\tleft: 50%;\n\ttop: 50%;\n\tmargin-left: -0.5em;\n\tmargin-top: -0.5em;\n\twidth: 0.2em;\n\theight: 1em;\n\tbackground: currentColor;\n\tpointer-events: none;\n}\n.beepboxEditor button.prevBarButton::after {\n\tcontent: \"\";\n\tposition: absolute;\n\tleft: 50%;\n\ttop: 50%;\n\tmargin-left: -0.3em;\n\tmargin-top: -0.5em;\n\tborder-right: 0.8em solid currentColor;\n\tborder-top: 0.5em solid transparent;\n\tborder-bottom: 0.5em solid transparent;\n\tpointer-events: none;\n}\n\n.beepboxEditor button.nextBarButton::before {\n\tcontent: \"\";\n\tposition: absolute;\n\tleft: 50%;\n\ttop: 50%;\n\tmargin-left: -0.5em;\n\tmargin-top: -0.5em;\n\tborder-left: 0.8em solid currentColor;\n\tborder-top: 0.5em solid transparent;\n\tborder-bottom: 0.5em solid transparent;\n\tpointer-events: none;\n}\n.beepboxEditor button.nextBarButton::after {\n\tcontent: \"\";\n\tposition: absolute;\n\tleft: 50%;\n\ttop: 50%;\n\tmargin-left: 0.3em;\n\tmargin-top: -0.5em;\n\twidth: 0.2em;\n\theight: 1em;\n\tbackground: currentColor;\n\tpointer-events: none;\n}\n\n.beepboxEditor canvas {\n\toverflow: hidden;\n\tposition: absolute;\n\tdisplay: block;\n}\n\n.beepboxEditor .trackContainer {\n\toverflow-x: hidden;\n}\n\n.beepboxEditor .selectRow {\n\tmargin: 0;\n\theight: 2.5em;\n\tdisplay: flex;\n\tflex-direction: row;\n\talign-items: center;\n\tjustify-content: space-between;\n}\n\n.beepboxEditor .selectRow > span {\n\tcolor: #999;\n}\n\n.beepboxEditor .operatorRow {\n\tmargin: 0;\n\theight: 2.5em;\n\tdisplay: flex;\n\tflex-direction: row;\n\talign-items: center;\n}\n\n.beepboxEditor .operatorRow > * {\n\tflex-grow: 1;\n\tflex-shrink: 1;\n}\n\n.beepboxEditor .editor-widget-column {\n\tdisplay: flex;\n\tflex-direction: column;\n}\n\n.beepboxEditor .editor-widgets {\n\tdisplay: flex;\n\tflex-direction: column;\n}\n\n.beepboxEditor .editor-menus {\n\tdisplay: flex;\n\tflex-direction: column;\n}\n\n.beepboxEditor .editor-settings {\n\tdisplay: flex;\n\tflex-direction: column;\n}\n\n.beepboxEditor .editor-song-settings {\n\tdisplay: flex;\n\tflex-direction: column;\n}\n\n.beepboxEditor .editor-instrument-settings {\n\tdisplay: flex;\n\tflex-direction: column;\n}\n.beepboxEditor .editor-right-widget-column {\n\tdisplay: flex;\n\tflex-direction: column;\n}\n\n\n\tdisplay: flex;\n\tflex-direction: column;\n}\n\n.beepboxEditor .editor-right-menus {\n\tdisplay: flex;\n\tflex-direction: column;\n}\n\n.beepboxEditor .editor-right-settings {\n\tdisplay: flex;\n\tflex-direction: column;\n}\n\n.beepboxEditor .editor-right-song-settings {\n\tdisplay: flex;\n\tflex-direction: column;\n}\n\n.beepboxEditor .editor-right-instrument-settings {\n\tdisplay: flex;\n\tflex-direction: column;\n}\n\n.beepboxEditor .editor-right-side-top > *, .beepboxEditor .editor-right-side-bottom > * {\n\tflex-shrink: 0;\n}\n\n.beepboxEditor input[type=text], .beepboxEditor input[type=number] {\n\tfont-size: inherit;\n\tbackground: transparent;\n\tborder: 1px solid #777;\n\tcolor: white;\n}\n\n.beepboxEditor input[type=checkbox] {\n  transform: scale(1.5);\n}\n\n.beepboxEditor input[type=range] {\n\t-webkit-appearance: none;\n\tcolor: inherit;\n\twidth: 100%;\n\theight: 2em;\n\tfont-size: inherit;\n\tmargin: 0;\n\tcursor: pointer;\n\tbackground-color: black;\n\ttouch-action: pan-y;\n}\n.beepboxEditor input[type=range]:focus {\n\toutline: none;\n}\n.beepboxEditor input[type=range]::-webkit-slider-runnable-track {\n\twidth: 100%;\n\theight: 0.5em;\n\tcursor: pointer;\n\tbackground: #363636;\n}\n.beepboxEditor input[type=range]::-webkit-slider-thumb {\n\theight: 2em;\n\twidth: 0.5em;\n\tborder-radius: 0.25em;\n\tbackground: currentColor;\n\tcursor: pointer;\n\t-webkit-appearance: none;\n\tmargin-top: -0.75em;\n}\n.beepboxEditor input[type=range]:focus::-webkit-slider-runnable-track {\n\tbackground: #565656;\n}\n.beepboxEditor input[type=range]::-moz-range-track {\n\twidth: 100%;\n\theight: 0.5em;\n\tcursor: pointer;\n\tbackground: #363636;\n}\n.beepboxEditor input[type=range]:focus::-moz-range-track {\n\tbackground: #565656;\n}\n.beepboxEditor input[type=range]::-moz-range-thumb {\n\theight: 2em;\n\twidth: 0.5em;\n\tborder-radius: 0.25em;\n\tborder: none;\n\tbackground: currentColor;\n\tcursor: pointer;\n}\n.beepboxEditor input[type=range]::-ms-track {\n\twidth: 100%;\n\theight: 0.5em;\n\tcursor: pointer;\n\tbackground: #363636;\n\tborder-color: transparent;\n}\n.beepboxEditor input[type=range]:focus::-ms-track {\n\tbackground: #565656;\n}\n.beepboxEditor input[type=range]::-ms-thumb {\n\theight: 2em;\n\twidth: 0.5em;\n\tborder-radius: 0.25em;\n\tbackground: currentColor;\n\tcursor: pointer;\n}\n.beepboxEditor .hintButton {\n\tborder: 1px solid currentColor;\n\tborder-radius: 50%;\n\ttext-decoration: none;\n\twidth: 1em;\n\theight: 1em;\n\ttext-align: center;\n\tmargin-left: auto;\n\tmargin-right: .4em;\n\tcursor: pointer;\n}\n\n/* wide screen */\n@media (min-width: 501px) {\n\t#beepboxEditorContainer {\n\t\tdisplay: table;\n\t}\n\t.beepboxEditor {\n\t\tflex-direction: row;\n\t}\n\t.beepboxEditor:focus-within {\n\t\toutline: 3px solid #555;\n\t}\n\t.beepboxEditor .trackContainer {\n\t\twidth: 512px;\n\t}\n\t.beepboxEditor .trackSelectBox {\n\t\tdisplay: none;\n\t}\n\t.beepboxEditor .playback-controls {\n\t\tdisplay: flex;\n\t\tflex-direction: column;\n\t}\n\t.beepboxEditor .playback-bar-controls {\n\t\tdisplay: flex;\n\t\tflex-direction: row;\n\t\tmargin: .2em 0;\n\t}\n\t.beepboxEditor .playback-volume-controls {\n\t\tdisplay: flex;\n\t\tflex-direction: row;\n\t\tmargin: .2em 0;\n\t\talign-items: center;\n\t}\n\t.beepboxEditor .pauseButton, .beepboxEditor .playButton {\n\t\tflex-grow: 1;\n\t}\n\t.beepboxEditor .nextBarButton, .beepboxEditor .prevBarButton {\n\t\tflex-grow: 1;\n\t\tmargin-left: 10px;\n\t}\n\t.beepboxEditor .editor-widget-column {\n\t\tmargin-left: 6px;\n\t\twidth: 14em;\n\t\tflex-direction: column;\n\t}\n\t.beepboxEditor .editor-right-widget-column {\n\t\tmargin-left: 6px;\n\t\twidth: 14em;\n\t\tflex-direction: column;\n\t}\n\t.beepboxEditor .editor-widgets {\n\t\tflex-grow: 1;\n\t}\n\t.beepboxEditor .editor-right-widgets {\n\t\tflex-grow: 1;\n\t}\n\t.beepboxEditor .editor-settings input, .beepboxEditor .editor-settings select {\n\t\twidth: 8.6em;\n\t}\n\t.beepboxEditor .editor-right-settings input, .beepboxEditor .editor-right-settings select {\n\t\twidth: 8.6em;\n\t}\n\t.beepboxEditor .editor-menus > * {\n\t\tflex-grow: 1;\n\t\tmargin: .2em 0;\n\t}\n\t.beepboxEditor .editor-right-menus > * {\n\t\tflex-grow: 1;\n\t\tmargin: .2em 0;\n\t}\n\t.beepboxEditor .editor-menus > button {\n\t\tpadding: 0 2em;\n\t\twhite-space: nowrap;\n\t}\n\t.beepboxEditor .editor-right-menus > button {\n\t\tpadding: 0 2em;\n\t\twhite-space: nowrap;\n\t}\n}\n\n/* narrow screen */\n@media (max-width: 500px) {\n\t.beepboxEditor {\n\t\tflex-direction: column;\n\t}\n\t.beepboxEditor:focus-within {\n\t\toutline: none;\n\t}\n\t.beepboxEditor .editorBox {\n\t\tmax-height: 75vh;\n\t}\n\t.beepboxEditor .editor-menus {\n\t\tflex-direction: row;\n\t}\n\t.beepboxEditor .editor-right-menus {\n\t\tflex-direction: row;\n\t}\n\t.beepboxEditor .editor-menus > * {\n\t\tflex-grow: 1;\n\t\tmargin: .10em;\n\t}\n\t.beepboxEditor .editor-right-menus > * {\n\t\tflex-grow: 1;\n\t\tmargin: .2em;\n\t}\n\t.beepboxEditor .editor-menus > button {\n\t\tpadding-left: 2em;\n\t\twhite-space: nowrap;\n\t}\n\t.beepboxEditor .editor-right-menus > button {\n\t\tpadding-left: 2em;\n\t\twhite-space: nowrap;\n\t}\n\t.beepboxEditor .trackContainer {\n\t\toverflow-x: auto;\n\t}\n\t.beepboxEditor .barScrollBar {\n\t\tdisplay: none;\n\t}\n\t.beepboxEditor .playback-controls {\n\t\tdisplay: flex;\n\t\tflex-direction: row;\n\t\tmargin: .2em 0;\n\t}\n\t.beepboxEditor .playback-bar-controls {\n\t\tdisplay: flex;\n\t\tflex-direction: row;\n\t\tflex-grow: 1;\n\t}\n\t.beepboxEditor .playback-volume-controls {\n\t\tdisplay: flex;\n\t\tflex-direction: row;\n\t\talign-items: center;\n\t\tflex-grow: 1;\n\t\tmargin: 0 .2em;\n\t}\n\t.beepboxEditor .editor-widget-column {\n\t\tflex-direction: column-reverse;\n\t}\n\t.beepboxEditor .editor-settings {\n\t\tflex-direction: row;\n\t}\n\t.beepboxEditor .editor-right-widget-column {\n\t\tflex-direction: column-reverse;\n\t}\n\t.beepboxEditor .editor-right-settings {\n\t\tflex-direction: row;\n\t}\n\t.beepboxEditor .pauseButton, .beepboxEditor .playButton,\n\t.beepboxEditor .nextBarButton, .beepboxEditor .prevBarButton {\n\t\tflex-grow: 1;\n\t\tmargin: 0 .2em;\n\t}\n\t.beepboxEditor .editor-song-settings, .beepboxEditor .editor-instrument-settings {\n\t\tflex-grow: 1;\n\t\tmargin: 0 .2em;\n\t}\n\t.beepboxEditor .editor-right-song-settings, .beepboxEditor .editor-right-instrument-settings {\n\t\tflex-grow: 1;\n\t\tmargin: 0 .2em;\n\t}\n\t.beepboxEditor .editor-settings input, .beepboxEditor .editor-settings .selectContainer {\n\t\twidth: 60%;\n\t}\n\t.beepboxEditor .editor-right-settings input, .beepboxEditor .editor-right-settings .selectContainer {\n\t\twidth: 60%;\n\t}\n\t.beepboxEditor .editor-settings select {\n\t\twidth: 100%;\n\t}\n\t.beepboxEditor .editor-right-settings select {\n\t\twidth: 100%;\n\t}\n\t.fullWidthOnly {\n\t\tdisplay: none;\n\t}\n\tp {\n\t\tmargin: 1em 0.5em;\n\t}\n}\n\n"));
    document.head.appendChild(styleSheet);
    var rightColumnStyleSheet = document.createElement("style");
    rightColumnStyleSheet.type = "text/css";
    rightColumnStyleSheet.appendChild(document.createTextNode("\n.beepboxEditor .editor-right-widget-column,\n.beepboxEditor .editor-right-widgets,\n.beepboxEditor .editor-right-menus,\n.beepboxEditor .editor-right-settings,\n.beepboxEditor .editor-right-song-settings,\n.beepboxEditor .editor-right-instrument-settings {\n\tdisplay: flex;\n\tflex-direction: column;\n}\n\n@media (min-width: 501px) {\n\t.beepboxEditor .editor-right-widget-column {\n\t\tmargin-left: 6px;\n\t\twidth: 14em;\n\t}\n\n\t.beepboxEditor .editor-right-widgets {\n\t\tflex-grow: 1;\n\t}\n\n\t.beepboxEditor .editor-right-menus > * {\n\t\tflex-grow: 1;\n\t\tmargin: .2em 0;\n\t}\n\n\t.beepboxEditor .editor-right-menus > button {\n\t\tpadding: 0 2em;\n\t\twhite-space: nowrap;\n\t}\n\n\t.beepboxEditor .editor-right-settings input,\n\t.beepboxEditor .editor-right-settings select {\n\t\twidth: 8.6em;\n\t}\n}\n\n@media (max-width: 500px) {\n\t.beepboxEditor .editor-right-widget-column {\n\t\tflex-direction: column-reverse;\n\t}\n\n\t.beepboxEditor .editor-right-menus {\n\t\tflex-direction: row;\n\t}\n\n\t.beepboxEditor .editor-right-menus > * {\n\t\tflex-grow: 1;\n\t\tmargin: .2em;\n\t}\n\n\t.beepboxEditor .editor-right-menus > button {\n\t\tpadding-left: 2em;\n\t\twhite-space: nowrap;\n\t}\n\n\t.beepboxEditor .editor-right-settings {\n\t\tflex-direction: row;\n\t}\n\n\t.beepboxEditor .editor-right-song-settings,\n\t.beepboxEditor .editor-right-instrument-settings {\n\t\tflex-grow: 1;\n\t\tmargin: 0 .2em;\n\t}\n\n\t.beepboxEditor .editor-right-settings input,\n\t.beepboxEditor .editor-right-settings .selectContainer {\n\t\twidth: 60%;\n\t}\n\n\t.beepboxEditor .editor-right-settings select {\n\t\twidth: 100%;\n\t}\n}\n"));
    document.head.appendChild(rightColumnStyleSheet);
})(beepbox || (beepbox = {}));
// Undoable change primitives shared by all editor mutations.
var beepbox;
(function (beepbox) {
    var Change = (function () {
        function Change() {
            this._noop = true;
        }
        Change.prototype._didSomething = function () {
            this._noop = false;
        };
        Change.prototype.isNoop = function () {
            return this._noop;
        };
        return Change;
    }());
    beepbox.Change = Change;
    var UndoableChange = (function (_super) {
        __extends(UndoableChange, _super);
        function UndoableChange(reversed) {
            var _this = _super.call(this) || this;
            _this._reversed = reversed;
            _this._doneForwards = !reversed;
            return _this;
        }
        UndoableChange.prototype.undo = function () {
            if (this._reversed) {
                this._doForwards();
                this._doneForwards = true;
            }
            else {
                this._doBackwards();
                this._doneForwards = false;
            }
        };
        UndoableChange.prototype.redo = function () {
            if (this._reversed) {
                this._doBackwards();
                this._doneForwards = false;
            }
            else {
                this._doForwards();
                this._doneForwards = true;
            }
        };
        UndoableChange.prototype._isDoneForwards = function () {
            return this._doneForwards;
        };
        UndoableChange.prototype._doForwards = function () {
            throw new Error("Change.doForwards(): Override me.");
        };
        UndoableChange.prototype._doBackwards = function () {
            throw new Error("Change.doBackwards(): Override me.");
        };
        return UndoableChange;
    }(Change));
    beepbox.UndoableChange = UndoableChange;
    var ChangeGroup = (function (_super) {
        __extends(ChangeGroup, _super);
        function ChangeGroup() {
            return _super.call(this) || this;
        }
        ChangeGroup.prototype.append = function (change) {
            if (change.isNoop())
                return;
            this._didSomething();
        };
        return ChangeGroup;
    }(Change));
    beepbox.ChangeGroup = ChangeGroup;
    var ChangeSequence = (function (_super) {
        __extends(ChangeSequence, _super);
        function ChangeSequence(changes) {
            var _this = _super.call(this, false) || this;
            if (changes == undefined) {
                _this._changes = [];
            }
            else {
                _this._changes = changes.concat();
            }
            return _this;
        }
        ChangeSequence.prototype.append = function (change) {
            if (change.isNoop())
                return;
            this._changes[this._changes.length] = change;
            this._didSomething();
        };
        ChangeSequence.prototype._doForwards = function () {
            for (var i = 0; i < this._changes.length; i++) {
                this._changes[i].redo();
            }
        };
        ChangeSequence.prototype._doBackwards = function () {
            for (var i = this._changes.length - 1; i >= 0; i--) {
                this._changes[i].undo();
            }
        };
        return ChangeSequence;
    }(UndoableChange));
    beepbox.ChangeSequence = ChangeSequence;
})(beepbox || (beepbox = {}));
// Concrete change implementations for song, pattern, channel, and instrument edits.
var beepbox;
(function (beepbox) {
    var ChangePins = (function (_super) {
        __extends(ChangePins, _super);
        function ChangePins(_doc, _note) {
            var _this = _super.call(this, false) || this;
            _this._doc = _doc;
            _this._note = _note;
            _this._oldStart = _this._note.start;
            _this._oldEnd = _this._note.end;
            _this._newStart = _this._note.start;
            _this._newEnd = _this._note.end;
            _this._oldPins = _this._note.pins;
            _this._newPins = [];
            _this._oldPitches = _this._note.pitches;
            _this._newPitches = [];
            return _this;
        }
        ChangePins.prototype._finishSetup = function () {
            for (var i = 0; i < this._newPins.length - 1;) {
                if (this._newPins[i].time >= this._newPins[i + 1].time) {
                    this._newPins.splice(i, 1);
                }
                else {
                    i++;
                }
            }
            for (var i = 1; i < this._newPins.length - 1;) {
                if (this._newPins[i - 1].interval == this._newPins[i].interval &&
                    this._newPins[i].interval == this._newPins[i + 1].interval &&
                    this._newPins[i - 1].volume == this._newPins[i].volume &&
                    this._newPins[i].volume == this._newPins[i + 1].volume) {
                    this._newPins.splice(i, 1);
                }
                else {
                    i++;
                }
            }
            var firstInterval = this._newPins[0].interval;
            var firstTime = this._newPins[0].time;
            for (var i = 0; i < this._oldPitches.length; i++) {
                this._newPitches[i] = this._oldPitches[i] + firstInterval;
            }
            for (var i = 0; i < this._newPins.length; i++) {
                this._newPins[i].interval -= firstInterval;
                this._newPins[i].time -= firstTime;
            }
            this._newStart = this._oldStart + firstTime;
            this._newEnd = this._newStart + this._newPins[this._newPins.length - 1].time;
            this._doForwards();
            this._didSomething();
        };
        ChangePins.prototype._doForwards = function () {
            this._note.pins = this._newPins;
            this._note.pitches = this._newPitches;
            this._note.start = this._newStart;
            this._note.end = this._newEnd;
            this._doc.notifier.changed();
        };
        ChangePins.prototype._doBackwards = function () {
            this._note.pins = this._oldPins;
            this._note.pitches = this._oldPitches;
            this._note.start = this._oldStart;
            this._note.end = this._oldEnd;
            this._doc.notifier.changed();
        };
        return ChangePins;
    }(beepbox.UndoableChange));
    beepbox.ChangePins = ChangePins;
    var ChangeInstrumentType = (function (_super) {
        __extends(ChangeInstrumentType, _super);
        function ChangeInstrumentType(doc, newValue) {
            var _this = _super.call(this) || this;
            var oldValue = doc.song.channels[doc.channel].instruments[doc.getCurrentInstrument()].type;
            if (oldValue != newValue) {
                doc.song.channels[doc.channel].instruments[doc.getCurrentInstrument()].type = newValue;
                doc.notifier.changed();
                _this._didSomething();
            }
            return _this;
        }
        return ChangeInstrumentType;
    }(beepbox.Change));
    beepbox.ChangeInstrumentType = ChangeInstrumentType;
    var ChangeTransition = (function (_super) {
        __extends(ChangeTransition, _super);
        function ChangeTransition(doc, newValue) {
            var _this = _super.call(this) || this;
            var oldValue = doc.song.channels[doc.channel].instruments[doc.getCurrentInstrument()].transition;
            if (oldValue != newValue) {
                _this._didSomething();
                doc.song.channels[doc.channel].instruments[doc.getCurrentInstrument()].transition = newValue;
                doc.notifier.changed();
            }
            return _this;
        }
        return ChangeTransition;
    }(beepbox.Change));
    beepbox.ChangeTransition = ChangeTransition;
    var ChangePattern = (function (_super) {
        __extends(ChangePattern, _super);
        function ChangePattern(doc, oldValue, newValue) {
            var _this = _super.call(this) || this;
            _this.oldValue = oldValue;
            if (newValue > doc.song.patternsPerChannel)
                throw new Error("invalid pattern");
            doc.song.channels[doc.channel].bars[doc.bar] = newValue;
            doc.notifier.changed();
            if (oldValue != newValue)
                _this._didSomething();
            return _this;
        }
        return ChangePattern;
    }(beepbox.Change));
    beepbox.ChangePattern = ChangePattern;
    var ChangeBarCount = (function (_super) {
        __extends(ChangeBarCount, _super);
        function ChangeBarCount(doc, newValue) {
            var _this = _super.call(this) || this;
            if (doc.song.barCount != newValue) {
                for (var channel = 0; channel < doc.song.getChannelCount(); channel++) {
                    for (var bar = doc.song.barCount; bar < newValue; bar++) {
                        doc.song.channels[channel].bars[bar] = 0;
                    }
                    doc.song.channels[channel].bars.length = newValue;
                }
                var newBar = doc.bar;
                var newBarScrollPos = doc.barScrollPos;
                var newLoopStart = doc.song.loopStart;
                var newLoopLength = doc.song.loopLength;
                if (doc.song.barCount > newValue) {
                    newBar = Math.min(newBar, newValue - 1);
                    newBarScrollPos = Math.max(0, Math.min(newValue - doc.trackVisibleBars, newBarScrollPos));
                    newLoopLength = Math.min(newValue, newLoopLength);
                    newLoopStart = Math.min(newValue - newLoopLength, newLoopStart);
                }
                doc.bar = newBar;
                doc.barScrollPos = newBarScrollPos;
                doc.song.loopStart = newLoopStart;
                doc.song.loopLength = newLoopLength;
                doc.song.barCount = newValue;
                doc.notifier.changed();
                _this._didSomething();
            }
            return _this;
        }
        return ChangeBarCount;
    }(beepbox.Change));
    beepbox.ChangeBarCount = ChangeBarCount;
    var ChangeInsertBar = (function (_super) {
        __extends(ChangeInsertBar, _super);
        function ChangeInsertBar(doc, insertionIndex) {
            var _this = _super.call(this) || this;
            if (doc.song.barCount >= beepbox.Config.barCountMax)
                return _this;
            insertionIndex = Math.max(0, Math.min(doc.song.barCount, insertionIndex));
            for (var channel = 0; channel < doc.song.getChannelCount(); channel++) {
                var bars = doc.song.channels[channel].bars;
                for (var bar = doc.song.barCount; bar > insertionIndex; bar--) {
                    bars[bar] = bars[bar - 1];
                }
                bars[insertionIndex] = 0;
                bars.length = doc.song.barCount + 1;
            }
            if (insertionIndex <= doc.song.loopStart) {
                doc.song.loopStart++;
            }
            else if (insertionIndex < doc.song.loopStart + doc.song.loopLength) {
                doc.song.loopLength++;
            }
            doc.song.barCount++;
            doc.notifier.changed();
            _this._didSomething();
            return _this;
        }
        return ChangeInsertBar;
    }(beepbox.Change));
    beepbox.ChangeInsertBar = ChangeInsertBar;
    var ChangeDeleteBar = (function (_super) {
        __extends(ChangeDeleteBar, _super);
        function ChangeDeleteBar(doc, deletionIndex) {
            var _this = _super.call(this) || this;
            if (doc.song.barCount <= beepbox.Config.barCountMin)
                return _this;
            deletionIndex = Math.max(0, Math.min(doc.song.barCount - 1, deletionIndex));
            for (var channel = 0; channel < doc.song.getChannelCount(); channel++) {
                var bars = doc.song.channels[channel].bars;
                for (var bar = deletionIndex; bar < doc.song.barCount - 1; bar++) {
                    bars[bar] = bars[bar + 1];
                }
                bars.length = doc.song.barCount - 1;
            }
            if (deletionIndex < doc.song.loopStart) {
                doc.song.loopStart = Math.max(0, doc.song.loopStart - 1);
            }
            else if (deletionIndex < doc.song.loopStart + doc.song.loopLength) {
                doc.song.loopLength = Math.max(1, doc.song.loopLength - 1);
                if (doc.song.loopStart + doc.song.loopLength > doc.song.barCount - 1) {
                    doc.song.loopStart = Math.max(0, doc.song.barCount - 1 - doc.song.loopLength);
                }
            }
            doc.song.barCount--;
            doc.bar = Math.min(doc.bar, doc.song.barCount - 1);
            doc.barScrollPos = Math.max(0, Math.min(doc.song.barCount - doc.trackVisibleBars, doc.barScrollPos));
            doc.notifier.changed();
            _this._didSomething();
            return _this;
        }
        return ChangeDeleteBar;
    }(beepbox.Change));
    beepbox.ChangeDeleteBar = ChangeDeleteBar;
    var ChangeChannelCount = (function (_super) {
        __extends(ChangeChannelCount, _super);
        function ChangeChannelCount(doc, newPitchChannelCount, newDrumChannelCount) {
            var _this = _super.call(this) || this;
            if (doc.song.pitchChannelCount != newPitchChannelCount || doc.song.drumChannelCount != newDrumChannelCount) {
                var newChannels = [];
                for (var i = 0; i < newPitchChannelCount; i++) {
                    var channel = i;
                    var oldChannel = i;
                    if (i < doc.song.pitchChannelCount) {
                        newChannels[channel] = doc.song.channels[oldChannel];
                    }
                    else {
                        newChannels[channel] = new beepbox.Channel();
                        newChannels[channel].octave = 2;
                        for (var j = 0; j < doc.song.instrumentsPerChannel; j++)
                            newChannels[channel].instruments[j] = new beepbox.Instrument();
                        for (var j = 0; j < doc.song.patternsPerChannel; j++)
                            newChannels[channel].patterns[j] = new beepbox.Pattern();
                        for (var j = 0; j < doc.song.barCount; j++)
                            newChannels[channel].bars[j] = 1;
                    }
                }
                for (var i = 0; i < newDrumChannelCount; i++) {
                    var channel = i + newPitchChannelCount;
                    var oldChannel = i + doc.song.pitchChannelCount;
                    if (i < doc.song.drumChannelCount) {
                        newChannels[channel] = doc.song.channels[oldChannel];
                    }
                    else {
                        newChannels[channel] = new beepbox.Channel();
                        newChannels[channel].octave = 0;
                        for (var j = 0; j < doc.song.instrumentsPerChannel; j++)
                            newChannels[channel].instruments[j] = new beepbox.Instrument();
                        for (var j = 0; j < doc.song.patternsPerChannel; j++)
                            newChannels[channel].patterns[j] = new beepbox.Pattern();
                        for (var j = 0; j < doc.song.barCount; j++)
                            newChannels[channel].bars[j] = 1;
                    }
                }
                doc.song.pitchChannelCount = newPitchChannelCount;
                doc.song.drumChannelCount = newDrumChannelCount;
                for (var channel = 0; channel < doc.song.getChannelCount(); channel++) {
                    doc.song.channels[channel] = newChannels[channel];
                }
                doc.song.channels.length = doc.song.getChannelCount();
                doc.channel = Math.min(doc.channel, newPitchChannelCount + newDrumChannelCount - 1);
                doc.notifier.changed();
                _this._didSomething();
            }
            return _this;
        }
        return ChangeChannelCount;
    }(beepbox.Change));
    beepbox.ChangeChannelCount = ChangeChannelCount;
    var ChangeBeatsPerBar = (function (_super) {
        __extends(ChangeBeatsPerBar, _super);
        function ChangeBeatsPerBar(doc, newValue) {
            var _this = _super.call(this) || this;
            if (doc.song.beatsPerBar != newValue) {
                if (doc.song.beatsPerBar > newValue) {
                    var sequence = new beepbox.ChangeSequence();
                    for (var i = 0; i < doc.song.getChannelCount(); i++) {
                        for (var j = 0; j < doc.song.channels[i].patterns.length; j++) {
                            sequence.append(new ChangeNoteTruncate(doc, doc.song.channels[i].patterns[j], newValue * doc.song.partsPerBeat, doc.song.beatsPerBar * doc.song.partsPerBeat));
                        }
                    }
                }
                doc.song.beatsPerBar = newValue;
                doc.notifier.changed();
                _this._didSomething();
            }
            return _this;
        }
        return ChangeBeatsPerBar;
    }(beepbox.Change));
    beepbox.ChangeBeatsPerBar = ChangeBeatsPerBar;
    var ChangeChannelBar = (function (_super) {
        __extends(ChangeChannelBar, _super);
        function ChangeChannelBar(doc, newChannel, newBar) {
            var _this = _super.call(this) || this;
            var oldChannel = doc.channel;
            var oldBar = doc.bar;
            doc.channel = newChannel;
            doc.bar = newBar;
            doc.barScrollPos = Math.min(doc.bar, Math.max(doc.bar - (doc.trackVisibleBars - 1), doc.barScrollPos));
            doc.notifier.changed();
            if (oldChannel != newChannel || oldBar != newBar) {
                _this._didSomething();
            }
            return _this;
        }
        return ChangeChannelBar;
    }(beepbox.Change));
    beepbox.ChangeChannelBar = ChangeChannelBar;
    var ChangeBarPattern = (function (_super) {
        __extends(ChangeBarPattern, _super);
        function ChangeBarPattern(doc, channelIndex, barIndex, newPatternIndex) {
            var _this = _super.call(this, false) || this;
            _this._doc = doc;
            _this._channelIndex = channelIndex;
            _this._barIndex = barIndex;
            _this._oldPatternIndex = doc.song.channels[channelIndex].bars[barIndex];
            _this._newPatternIndex = newPatternIndex;
            if (_this._oldPatternIndex != _this._newPatternIndex) {
                _this._didSomething();
                _this.redo();
            }
            return _this;
        }
        ChangeBarPattern.prototype._doForwards = function () {
            this._doc.song.channels[this._channelIndex].bars[this._barIndex] = this._newPatternIndex;
            this._doc.notifier.changed();
        };
        ChangeBarPattern.prototype._doBackwards = function () {
            this._doc.song.channels[this._channelIndex].bars[this._barIndex] = this._oldPatternIndex;
            this._doc.notifier.changed();
        };
        return ChangeBarPattern;
    }(beepbox.UndoableChange));
    beepbox.ChangeBarPattern = ChangeBarPattern;
    var ChangePatternContents = (function (_super) {
        __extends(ChangePatternContents, _super);
        function ChangePatternContents(doc, pattern, notes, instrument) {
            var _this = _super.call(this, false) || this;
            _this._doc = doc;
            _this._pattern = pattern;
            _this._oldNotes = beepbox.cloneNoteArray(pattern.notes);
            _this._newNotes = beepbox.cloneNoteArray(notes);
            _this._oldInstrument = pattern.instrument;
            _this._newInstrument = instrument;
            if (_this._oldInstrument != _this._newInstrument || JSON.stringify(_this._oldNotes) != JSON.stringify(_this._newNotes)) {
                _this._didSomething();
                _this.redo();
            }
            return _this;
        }
        ChangePatternContents.prototype._doForwards = function () {
            this._pattern.notes = beepbox.cloneNoteArray(this._newNotes);
            this._pattern.instrument = this._newInstrument;
            this._doc.notifier.changed();
        };
        ChangePatternContents.prototype._doBackwards = function () {
            this._pattern.notes = beepbox.cloneNoteArray(this._oldNotes);
            this._pattern.instrument = this._oldInstrument;
            this._doc.notifier.changed();
        };
        return ChangePatternContents;
    }(beepbox.UndoableChange));
    beepbox.ChangePatternContents = ChangePatternContents;
    var ChangeEnsurePatternExists = (function (_super) {
        __extends(ChangeEnsurePatternExists, _super);
        function ChangeEnsurePatternExists(doc, channelIndex, barIndex) {
            var _this = _super.call(this, false) || this;
            _this._doc = doc;
            _this._channelIndex = channelIndex;
            _this._barIndex = barIndex;
            _this._patternIndex = 0;
            _this._oldPatternCount = doc.song.patternsPerChannel;
            _this._newPatternCount = doc.song.patternsPerChannel;
            _this._newInstrument = doc.getCurrentInstrument();
            var song = doc.song;
            if (song.channels[channelIndex].bars[barIndex] != 0) {
                return _this;
            }
            var firstEmptyUnusedIndex = null;
            var firstUnusedIndex = null;
            for (var patternIndex = 1; patternIndex <= song.patternsPerChannel; patternIndex++) {
                var used = false;
                for (var testBar = 0; testBar < song.barCount; testBar++) {
                    if (song.channels[channelIndex].bars[testBar] == patternIndex) {
                        used = true;
                        break;
                    }
                }
                if (used)
                    continue;
                if (firstUnusedIndex == null) {
                    firstUnusedIndex = patternIndex;
                }
                if (song.channels[channelIndex].patterns[patternIndex - 1].notes.length == 0) {
                    firstEmptyUnusedIndex = patternIndex;
                    break;
                }
            }
            if (firstEmptyUnusedIndex != null) {
                _this._patternIndex = firstEmptyUnusedIndex;
                _this._oldInstrument = song.channels[channelIndex].patterns[firstEmptyUnusedIndex - 1].instrument;
            }
            else if (song.patternsPerChannel < song.barCount) {
                _this._newPatternCount = song.patternsPerChannel + 1;
                _this._patternIndex = _this._newPatternCount;
            }
            else if (firstUnusedIndex != null) {
                _this._patternIndex = firstUnusedIndex;
                _this._oldNotes = song.channels[channelIndex].patterns[firstUnusedIndex - 1].notes;
                _this._oldInstrument = song.channels[channelIndex].patterns[firstUnusedIndex - 1].instrument;
            }
            if (_this._patternIndex != 0) {
                _this._didSomething();
                _this.redo();
            }
            return _this;
        }
        ChangeEnsurePatternExists.prototype._doForwards = function () {
            if (this._patternIndex == 0)
                return;
            var song = this._doc.song;
            for (var pattern = song.patternsPerChannel; pattern < this._newPatternCount; pattern++) {
                for (var channel = 0; channel < song.getChannelCount(); channel++) {
                    song.channels[channel].patterns[pattern] = new beepbox.Pattern();
                }
            }
            song.patternsPerChannel = this._newPatternCount;
            var ensuredPattern = song.channels[this._channelIndex].patterns[this._patternIndex - 1];
            ensuredPattern.notes = [];
            ensuredPattern.instrument = this._newInstrument;
            song.channels[this._channelIndex].bars[this._barIndex] = this._patternIndex;
            this._doc.notifier.changed();
        };
        ChangeEnsurePatternExists.prototype._doBackwards = function () {
            if (this._patternIndex == 0)
                return;
            var song = this._doc.song;
            var ensuredPattern = song.channels[this._channelIndex].patterns[this._patternIndex - 1];
            if (this._oldNotes != null) {
                ensuredPattern.notes = this._oldNotes;
            }
            if (this._oldInstrument != null) {
                ensuredPattern.instrument = this._oldInstrument;
            }
            song.channels[this._channelIndex].bars[this._barIndex] = 0;
            for (var channel = 0; channel < song.getChannelCount(); channel++) {
                song.channels[channel].patterns.length = this._oldPatternCount;
            }
            song.patternsPerChannel = this._oldPatternCount;
            this._doc.notifier.changed();
        };
        return ChangeEnsurePatternExists;
    }(beepbox.UndoableChange));
    beepbox.ChangeEnsurePatternExists = ChangeEnsurePatternExists;
    var ChangeVolBend = (function (_super) {
        __extends(ChangeVolBend, _super);
        function ChangeVolBend(doc, newValue) {
            var _this = _super.call(this) || this;
            var oldValue = doc.song.getVolBend;
            if (oldValue != newValue) {
                _this._didSomething();
                doc.song.getVolBend = newValue;
                doc.notifier.changed();
            }
            return _this;
        }
        return ChangeVolBend;
    }(beepbox.Change));
    beepbox.ChangeVolBend = ChangeVolBend;
    var ChangeChorus = (function (_super) {
        __extends(ChangeChorus, _super);
        function ChangeChorus(doc, newValue) {
            var _this = _super.call(this) || this;
            var oldValue = doc.song.channels[doc.channel].instruments[doc.getCurrentInstrument()].chorus;
            if (oldValue != newValue) {
                _this._didSomething();
                doc.song.channels[doc.channel].instruments[doc.getCurrentInstrument()].chorus = newValue;
                doc.notifier.changed();
            }
            return _this;
        }
        return ChangeChorus;
    }(beepbox.Change));
    beepbox.ChangeChorus = ChangeChorus;
    var ChangeEffect = (function (_super) {
        __extends(ChangeEffect, _super);
        function ChangeEffect(doc, newValue) {
            var _this = _super.call(this) || this;
            var oldValue = doc.song.channels[doc.channel].instruments[doc.getCurrentInstrument()].effect;
            if (oldValue != newValue) {
                doc.song.channels[doc.channel].instruments[doc.getCurrentInstrument()].effect = newValue;
                doc.notifier.changed();
                _this._didSomething();
            }
            return _this;
        }
        return ChangeEffect;
    }(beepbox.Change));
    beepbox.ChangeEffect = ChangeEffect;
	
	var ChangeHarm = (function (_super) {
        __extends(ChangeHarm, _super);
        function ChangeHarm(doc, newValue) {
            var _this = _super.call(this) || this;
            var oldValue = doc.song.channels[doc.channel].instruments[doc.getCurrentInstrument()].harm;
            if (oldValue != newValue) {
                doc.song.channels[doc.channel].instruments[doc.getCurrentInstrument()].harm = newValue;
                doc.notifier.changed();
                _this._didSomething();
            }
            return _this;
        }
        return ChangeHarm;
    }(beepbox.Change));
    beepbox.ChangeHarm = ChangeHarm;
	
	var ChangeFMChorus = (function (_super) {
        __extends(ChangeFMChorus, _super);
        function ChangeFMChorus(doc, newValue) {
            var _this = _super.call(this) || this;
            var oldValue = doc.song.channels[doc.channel].instruments[doc.getCurrentInstrument()].fmChorus;
            if (oldValue != newValue) {
                doc.song.channels[doc.channel].instruments[doc.getCurrentInstrument()].fmChorus = newValue;
                doc.notifier.changed();
                _this._didSomething();
            }
            return _this;
        }
        return ChangeFMChorus;
    }(beepbox.Change));
    beepbox.ChangeFMChorus = ChangeFMChorus;
	
	var ChangeOctaveOffset = (function (_super) {
        __extends(ChangeOctaveOffset, _super);
        function ChangeOctaveOffset(doc, newValue) {
            var _this = _super.call(this) || this;
            var oldValue = doc.song.channels[doc.channel].instruments[doc.getCurrentInstrument()].octaveOffset;
            if (oldValue != newValue) {
                doc.song.channels[doc.channel].instruments[doc.getCurrentInstrument()].octaveOffset = newValue;
                doc.notifier.changed();
                _this._didSomething();
            }
            return _this;
        }
        return ChangeOctaveOffset;
    }(beepbox.Change));
    beepbox.ChangeOctaveOffset = ChangeOctaveOffset;
	var ChangeInstrumentMute = (function (_super) {
        __extends(ChangeInstrumentMute, _super);
        function ChangeInstrumentMute(doc, newValue) {
            var _this = _super.call(this) || this;
            var oldValue = doc.song.channels[doc.channel].instruments[doc.getCurrentInstrument()].muteState;
            if (oldValue != newValue) {
                doc.song.channels[doc.channel].instruments[doc.getCurrentInstrument()].muteState = newValue;
                doc.notifier.changed();
                _this._didSomething();
            }
            return _this;
        }
        return ChangeInstrumentMute;
    }(beepbox.Change));
    beepbox.ChangeInstrumentMute = ChangeInstrumentMute;
	var ChangeSoloChannel = (function (_super) {
        __extends(ChangeSoloChannel, _super);
        function ChangeSoloChannel(doc, soloChannel) {
            var _this = _super.call(this, false) || this;
            _this._doc = doc;
            _this._oldValues = [];
            _this._newValues = [];
            var alreadySoloed = true;
            for (var channel = 0; channel < doc.song.getChannelCount(); channel++) {
                var shouldBeMuted = channel != soloChannel;
                _this._oldValues[channel] = [];
                _this._newValues[channel] = [];
                for (var instrument = 0; instrument < doc.song.channels[channel].instruments.length; instrument++) {
                    var oldValue = doc.song.channels[channel].instruments[instrument].muteState;
                    if (oldValue != (shouldBeMuted ? 1 : 0)) {
                        alreadySoloed = false;
                    }
                    var newValue = alreadySoloed ? 0 : (shouldBeMuted ? 1 : 0);
                    _this._oldValues[channel][instrument] = oldValue;
                    _this._newValues[channel][instrument] = newValue;
                }
            }
            for (var channel = 0; channel < doc.song.getChannelCount(); channel++) {
                for (var instrument = 0; instrument < doc.song.channels[channel].instruments.length; instrument++) {
                    if (_this._oldValues[channel][instrument] != _this._newValues[channel][instrument]) {
                        _this._didSomething();
                    }
                }
            }
            if (!_this.isNoop()) {
                _this.redo();
            }
            return _this;
        }
        ChangeSoloChannel.prototype._applyValues = function (values) {
            for (var channel = 0; channel < this._doc.song.getChannelCount(); channel++) {
                for (var instrument = 0; instrument < this._doc.song.channels[channel].instruments.length; instrument++) {
                    this._doc.song.channels[channel].instruments[instrument].muteState = values[channel][instrument];
                }
            }
            this._doc.notifier.changed();
        };
        ChangeSoloChannel.prototype._doForwards = function () {
            this._applyValues(this._newValues);
        };
        ChangeSoloChannel.prototype._doBackwards = function () {
            this._applyValues(this._oldValues);
        };
        return ChangeSoloChannel;
    }(beepbox.UndoableChange));
    beepbox.ChangeSoloChannel = ChangeSoloChannel;
	
    var ChangePan = (function (_super) {
        __extends(ChangePan, _super);
        function ChangePan(doc, oldValue, newValue) {
            var _this = _super.call(this) || this;
            doc.song.channels[doc.channel].instruments[doc.getCurrentInstrument()].pan = newValue;
            doc.notifier.changed();
            if (oldValue != newValue)
                _this._didSomething();
            return _this;
        }
        return ChangePan;
    }(beepbox.Change));
    beepbox.ChangePan = ChangePan;
	
    var ChangeFilter = (function (_super) {
        __extends(ChangeFilter, _super);
        function ChangeFilter(doc, newValue) {
            var _this = _super.call(this) || this;
            var oldValue = doc.song.channels[doc.channel].instruments[doc.getCurrentInstrument()].filter;
            if (oldValue != newValue) {
                doc.song.channels[doc.channel].instruments[doc.getCurrentInstrument()].filter = newValue;
                doc.notifier.changed();
                _this._didSomething();
            }
            return _this;
        }
        return ChangeFilter;
    }(beepbox.Change));
    beepbox.ChangeFilter = ChangeFilter;
    var ChangeAlgorithm = (function (_super) {
        __extends(ChangeAlgorithm, _super);
        function ChangeAlgorithm(doc, newValue) {
            var _this = _super.call(this) || this;
            var oldValue = doc.song.channels[doc.channel].instruments[doc.getCurrentInstrument()].algorithm;
            if (oldValue != newValue) {
                doc.song.channels[doc.channel].instruments[doc.getCurrentInstrument()].algorithm = newValue;
                doc.notifier.changed();
                _this._didSomething();
            }
            return _this;
        }
        return ChangeAlgorithm;
    }(beepbox.Change));
    beepbox.ChangeAlgorithm = ChangeAlgorithm;
    var ChangeFeedbackType = (function (_super) {
        __extends(ChangeFeedbackType, _super);
        function ChangeFeedbackType(doc, newValue) {
            var _this = _super.call(this) || this;
            var oldValue = doc.song.channels[doc.channel].instruments[doc.getCurrentInstrument()].feedbackType;
            if (oldValue != newValue) {
                doc.song.channels[doc.channel].instruments[doc.getCurrentInstrument()].feedbackType = newValue;
                doc.notifier.changed();
                _this._didSomething();
            }
            return _this;
        }
        return ChangeFeedbackType;
    }(beepbox.Change));
    beepbox.ChangeFeedbackType = ChangeFeedbackType;
    var ChangeFeedbackEnvelope = (function (_super) {
        __extends(ChangeFeedbackEnvelope, _super);
        function ChangeFeedbackEnvelope(doc, newValue) {
            var _this = _super.call(this) || this;
            var oldValue = doc.song.channels[doc.channel].instruments[doc.getCurrentInstrument()].feedbackEnvelope;
            if (oldValue != newValue) {
                doc.song.channels[doc.channel].instruments[doc.getCurrentInstrument()].feedbackEnvelope = newValue;
                doc.notifier.changed();
                _this._didSomething();
            }
            return _this;
        }
        return ChangeFeedbackEnvelope;
    }(beepbox.Change));
    beepbox.ChangeFeedbackEnvelope = ChangeFeedbackEnvelope;
    var ChangeOperatorEnvelope = (function (_super) {
        __extends(ChangeOperatorEnvelope, _super);
        function ChangeOperatorEnvelope(doc, operatorIndex, newValue) {
            var _this = _super.call(this) || this;
            var oldValue = doc.song.channels[doc.channel].instruments[doc.getCurrentInstrument()].operators[operatorIndex].envelope;
            if (oldValue != newValue) {
                doc.song.channels[doc.channel].instruments[doc.getCurrentInstrument()].operators[operatorIndex].envelope = newValue;
                doc.notifier.changed();
                _this._didSomething();
            }
            return _this;
        }
        return ChangeOperatorEnvelope;
    }(beepbox.Change));
    beepbox.ChangeOperatorEnvelope = ChangeOperatorEnvelope;
    var ChangeOperatorFrequency = (function (_super) {
        __extends(ChangeOperatorFrequency, _super);
        function ChangeOperatorFrequency(doc, operatorIndex, newValue) {
            var _this = _super.call(this) || this;
            var oldValue = doc.song.channels[doc.channel].instruments[doc.getCurrentInstrument()].operators[operatorIndex].frequency;
            if (oldValue != newValue) {
                doc.song.channels[doc.channel].instruments[doc.getCurrentInstrument()].operators[operatorIndex].frequency = newValue;
                doc.notifier.changed();
                _this._didSomething();
            }
            return _this;
        }
        return ChangeOperatorFrequency;
    }(beepbox.Change));
    beepbox.ChangeOperatorFrequency = ChangeOperatorFrequency;
    var ChangeOperatorAmplitude = (function (_super) {
        __extends(ChangeOperatorAmplitude, _super);
        function ChangeOperatorAmplitude(doc, operatorIndex, oldValue, newValue) {
            var _this = _super.call(this) || this;
            doc.song.channels[doc.channel].instruments[doc.getCurrentInstrument()].operators[operatorIndex].amplitude = newValue;
            doc.notifier.changed();
            if (oldValue != newValue)
                _this._didSomething();
            return _this;
        }
        return ChangeOperatorAmplitude;
    }(beepbox.Change));
    beepbox.ChangeOperatorAmplitude = ChangeOperatorAmplitude;
    var ChangeFeedbackAmplitude = (function (_super) {
        __extends(ChangeFeedbackAmplitude, _super);
        function ChangeFeedbackAmplitude(doc, oldValue, newValue) {
            var _this = _super.call(this) || this;
            doc.song.channels[doc.channel].instruments[doc.getCurrentInstrument()].feedbackAmplitude = newValue;
            doc.notifier.changed();
            if (oldValue != newValue)
                _this._didSomething();
            return _this;
        }
        return ChangeFeedbackAmplitude;
    }(beepbox.Change));
    beepbox.ChangeFeedbackAmplitude = ChangeFeedbackAmplitude;
    var ChangeInstrumentsPerChannel = (function (_super) {
        __extends(ChangeInstrumentsPerChannel, _super);
        function ChangeInstrumentsPerChannel(doc, newInstrumentsPerChannel) {
            var _this = _super.call(this) || this;
            if (doc.song.instrumentsPerChannel != newInstrumentsPerChannel) {
                for (var channel = 0; channel < doc.song.getChannelCount(); channel++) {
                    var sampleInstrument = doc.song.channels[channel].instruments[doc.song.instrumentsPerChannel - 1];
                    for (var j = doc.song.instrumentsPerChannel; j < newInstrumentsPerChannel; j++) {
                        var newInstrument = new beepbox.Instrument();
                        newInstrument.copy(sampleInstrument);
                        doc.song.channels[channel].instruments[j] = newInstrument;
                    }
                    doc.song.channels[channel].instruments.length = newInstrumentsPerChannel;
                    for (var j = 0; j < doc.song.patternsPerChannel; j++) {
                        if (doc.song.channels[channel].patterns[j].instrument >= newInstrumentsPerChannel) {
                            doc.song.channels[channel].patterns[j].instrument = 0;
                        }
                    }
                }
                doc.song.instrumentsPerChannel = newInstrumentsPerChannel;
                doc.notifier.changed();
                _this._didSomething();
            }
            return _this;
        }
        return ChangeInstrumentsPerChannel;
    }(beepbox.Change));
    beepbox.ChangeInstrumentsPerChannel = ChangeInstrumentsPerChannel;
    var ChangeKey = (function (_super) {
        __extends(ChangeKey, _super);
        function ChangeKey(doc, newValue) {
            var _this = _super.call(this) || this;
            if (doc.song.key != newValue) {
                doc.song.key = newValue;
                doc.notifier.changed();
                _this._didSomething();
            }
            return _this;
        }
        return ChangeKey;
    }(beepbox.Change));
    beepbox.ChangeKey = ChangeKey;

    var ChangeTheme = (function (_super) {
        __extends(ChangeTheme, _super);
        function ChangeTheme(doc, newValue) {
            var _this = _super.call(this) || this;
            if (doc.song.theme != newValue) {
                doc.song.theme = newValue;
                doc.notifier.changed();
                _this._didSomething();
            }
            return _this;
        }
        return ChangeTheme;
    }(beepbox.Change));
    beepbox.ChangeTheme = ChangeTheme;
    var ChangeLoop = (function (_super) {
        __extends(ChangeLoop, _super);
        function ChangeLoop(_doc, oldStart, oldLength, newStart, newLength) {
            var _this = _super.call(this) || this;
            _this._doc = _doc;
            _this.oldStart = oldStart;
            _this.oldLength = oldLength;
            _this.newStart = newStart;
            _this.newLength = newLength;
            _this._doc.song.loopStart = _this.newStart;
            _this._doc.song.loopLength = _this.newLength;
            _this._doc.notifier.changed();
            if (_this.oldStart != _this.newStart || _this.oldLength != _this.newLength) {
                _this._didSomething();
            }
            return _this;
        }
        return ChangeLoop;
    }(beepbox.Change));
    beepbox.ChangeLoop = ChangeLoop;
    var ChangePitchAdded = (function (_super) {
        __extends(ChangePitchAdded, _super);
        function ChangePitchAdded(doc, note, pitch, index, deletion) {
            if (deletion === void 0) { deletion = false; }
            var _this = _super.call(this, deletion) || this;
            _this._doc = doc;
            _this._note = note;
            _this._pitch = pitch;
            _this._index = index;
            _this._didSomething();
            _this.redo();
            return _this;
        }
        ChangePitchAdded.prototype._doForwards = function () {
            this._note.pitches.splice(this._index, 0, this._pitch);
            this._doc.notifier.changed();
        };
        ChangePitchAdded.prototype._doBackwards = function () {
            this._note.pitches.splice(this._index, 1);
            this._doc.notifier.changed();
        };
        return ChangePitchAdded;
    }(beepbox.UndoableChange));
    beepbox.ChangePitchAdded = ChangePitchAdded;
    var ChangeOctave = (function (_super) {
        __extends(ChangeOctave, _super);
        function ChangeOctave(doc, oldValue, newValue) {
            var _this = _super.call(this) || this;
            _this.oldValue = oldValue;
            doc.song.channels[doc.channel].octave = newValue;
            doc.notifier.changed();
            if (oldValue != newValue)
                _this._didSomething();
            return _this;
        }
        return ChangeOctave;
    }(beepbox.Change));
    beepbox.ChangeOctave = ChangeOctave;
    var ChangePartsPerBeat = (function (_super) {
        __extends(ChangePartsPerBeat, _super);
        function ChangePartsPerBeat(doc, newValue) {
            var _this = _super.call(this) || this;
            if (doc.song.partsPerBeat != newValue) {
                for (var i = 0; i < doc.song.getChannelCount(); i++) {
                    for (var j = 0; j < doc.song.channels[i].patterns.length; j++) {
                        _this.append(new ChangeRhythm(doc, doc.song.channels[i].patterns[j], doc.song.partsPerBeat, newValue));
                    }
                }
                doc.song.partsPerBeat = newValue;
                doc.notifier.changed();
                _this._didSomething();
            }
            return _this;
        }
        return ChangePartsPerBeat;
    }(beepbox.ChangeGroup));
    beepbox.ChangePartsPerBeat = ChangePartsPerBeat;
    var ChangePaste = (function (_super) {
        __extends(ChangePaste, _super);
        function ChangePaste(doc, pattern, notes, newBeatsPerBar, newPartsPerBeat) {
            var _this = _super.call(this) || this;
            pattern.notes = notes;
            if (doc.song.partsPerBeat != newPartsPerBeat) {
                _this.append(new ChangeRhythm(doc, pattern, newPartsPerBeat, doc.song.partsPerBeat));
            }
            if (doc.song.beatsPerBar != newBeatsPerBar) {
                _this.append(new ChangeNoteTruncate(doc, pattern, doc.song.beatsPerBar * doc.song.partsPerBeat, newBeatsPerBar * doc.song.partsPerBeat));
            }
            doc.notifier.changed();
            _this._didSomething();
            return _this;
        }
        return ChangePaste;
    }(beepbox.ChangeGroup));
    beepbox.ChangePaste = ChangePaste;
    var ChangeInsPaste = (function (_super) {
        __extends(ChangeInsPaste, _super);
        function ChangeInsPaste(doc, instrument) {
            var _this = _super.call(this) || this;
            pattern.notes = notes;
            if (doc.song.partsPerBeat != newPartsPerBeat) {
                _this.append(new ChangeRhythm(doc, pattern, newPartsPerBeat, doc.song.partsPerBeat));
            }
            if (doc.song.beatsPerBar != newBeatsPerBar) {
                _this.append(new ChangeNoteTruncate(doc, pattern, doc.song.beatsPerBar * doc.song.partsPerBeat, newBeatsPerBar * doc.song.partsPerBeat));
            }
            doc.notifier.changed();
            _this._didSomething();
            return _this;
        }
        return ChangeInsPaste;
    }(beepbox.ChangeGroup));
    beepbox.ChangeInsPaste = ChangeInsPaste;
    var ChangePatternInstrument = (function (_super) {
        __extends(ChangePatternInstrument, _super);
        function ChangePatternInstrument(doc, newValue, pattern) {
            var _this = _super.call(this) || this;
            if (pattern.instrument != newValue) {
                pattern.instrument = newValue;
                doc.notifier.changed();
                _this._didSomething();
            }
            return _this;
        }
        return ChangePatternInstrument;
    }(beepbox.Change));
    beepbox.ChangePatternInstrument = ChangePatternInstrument;
    var ChangePatternsPerChannel = (function (_super) {
        __extends(ChangePatternsPerChannel, _super);
        function ChangePatternsPerChannel(doc, newValue) {
            var _this = _super.call(this) || this;
            if (doc.song.patternsPerChannel != newValue) {
                for (var i = 0; i < doc.song.getChannelCount(); i++) {
                    var channelBars = doc.song.channels[i].bars;
                    var channelPatterns = doc.song.channels[i].patterns;
                    for (var j = 0; j < channelBars.length; j++) {
                        if (channelBars[j] > newValue)
                            channelBars[j] = 0;
                    }
                    for (var j = channelPatterns.length; j < newValue; j++) {
                        channelPatterns[j] = new beepbox.Pattern();
                    }
                    channelPatterns.length = newValue;
                }
                doc.song.patternsPerChannel = newValue;
                doc.notifier.changed();
                _this._didSomething();
            }
            return _this;
        }
        return ChangePatternsPerChannel;
    }(beepbox.Change));
    beepbox.ChangePatternsPerChannel = ChangePatternsPerChannel;
    var ChangePinTime = (function (_super) {
        __extends(ChangePinTime, _super);
        function ChangePinTime(doc, note, pinIndex, shiftedTime) {
            var _this = _super.call(this, doc, note) || this;
            shiftedTime -= _this._oldStart;
            var originalTime = _this._oldPins[pinIndex].time;
            var skipStart = Math.min(originalTime, shiftedTime);
            var skipEnd = Math.max(originalTime, shiftedTime);
            var setPin = false;
            for (var i = 0; i < _this._oldPins.length; i++) {
                var oldPin = note.pins[i];
                var time = oldPin.time;
                if (time < skipStart) {
                    _this._newPins.push(beepbox.makeNotePin(oldPin.interval, time, oldPin.volume));
                }
                else if (time > skipEnd) {
                    if (!setPin) {
                        _this._newPins.push(beepbox.makeNotePin(_this._oldPins[pinIndex].interval, shiftedTime, _this._oldPins[pinIndex].volume));
                        setPin = true;
                    }
                    _this._newPins.push(beepbox.makeNotePin(oldPin.interval, time, oldPin.volume));
                }
            }
            if (!setPin) {
                _this._newPins.push(beepbox.makeNotePin(_this._oldPins[pinIndex].interval, shiftedTime, _this._oldPins[pinIndex].volume));
            }
            _this._finishSetup();
            return _this;
        }
        return ChangePinTime;
    }(ChangePins));
    beepbox.ChangePinTime = ChangePinTime;
    var ChangePitchBend = (function (_super) {
        __extends(ChangePitchBend, _super);
        function ChangePitchBend(doc, note, bendStart, bendEnd, bendTo, pitchIndex) {
            var _this = _super.call(this, doc, note) || this;
            bendStart -= _this._oldStart;
            bendEnd -= _this._oldStart;
            bendTo -= note.pitches[pitchIndex];
            var setStart = false;
            var setEnd = false;
            var prevInterval = 0;
            var prevVolume = 3;
            var persist = true;
            var i;
            var direction;
            var stop;
            var push;
            if (bendEnd > bendStart) {
                i = 0;
                direction = 1;
                stop = note.pins.length;
                push = function (item) { _this._newPins.push(item); };
            }
            else {
                i = note.pins.length - 1;
                direction = -1;
                stop = -1;
                push = function (item) { _this._newPins.unshift(item); };
            }
            for (; i != stop; i += direction) {
                var oldPin = note.pins[i];
                var time = oldPin.time;
                for (;;) {
                    if (!setStart) {
                        if (time * direction <= bendStart * direction) {
                            prevInterval = oldPin.interval;
                            prevVolume = oldPin.volume;
                        }
                        if (time * direction < bendStart * direction) {
                            push(beepbox.makeNotePin(oldPin.interval, time, oldPin.volume));
                            break;
                        }
                        else {
                            push(beepbox.makeNotePin(prevInterval, bendStart, prevVolume));
                            setStart = true;
                        }
                    }
                    else if (!setEnd) {
                        if (time * direction <= bendEnd * direction) {
                            prevInterval = oldPin.interval;
                            prevVolume = oldPin.volume;
                        }
                        if (time * direction < bendEnd * direction) {
                            break;
                        }
                        else {
                            push(beepbox.makeNotePin(bendTo, bendEnd, prevVolume));
                            setEnd = true;
                        }
                    }
                    else {
                        if (time * direction == bendEnd * direction) {
                            break;
                        }
                        else {
                            if (oldPin.interval != prevInterval)
                                persist = false;
                            push(beepbox.makeNotePin(persist ? bendTo : oldPin.interval, time, oldPin.volume));
                            break;
                        }
                    }
                }
            }
            if (!setEnd) {
                push(beepbox.makeNotePin(bendTo, bendEnd, prevVolume));
            }
            _this._finishSetup();
            return _this;
        }
        return ChangePitchBend;
    }(ChangePins));
    beepbox.ChangePitchBend = ChangePitchBend;
    var ChangeRhythm = (function (_super) {
        __extends(ChangeRhythm, _super);
        function ChangeRhythm(doc, bar, oldPartsPerBeat, newPartsPerBeat) {
            var _this = _super.call(this) || this;
            var changeRhythm;
            if (oldPartsPerBeat > newPartsPerBeat) {
                changeRhythm = function (oldTime) { return Math.ceil(oldTime * newPartsPerBeat / oldPartsPerBeat); };
            }
            else if (oldPartsPerBeat < newPartsPerBeat) {
                changeRhythm = function (oldTime) { return Math.floor(oldTime * newPartsPerBeat / oldPartsPerBeat); };
            }
            else {
                throw new Error("ChangeRhythm couldn't handle rhythm change from " + oldPartsPerBeat + " to " + newPartsPerBeat + ".");
            }
            var i = 0;
            while (i < bar.notes.length) {
                var note = bar.notes[i];
                if (changeRhythm(note.start) >= changeRhythm(note.end)) {
                    _this.append(new ChangeNoteAdded(doc, bar, note, i, true));
                }
                else {
                    _this.append(new ChangeRhythmNote(doc, note, changeRhythm));
                    i++;
                }
            }
            return _this;
        }
        return ChangeRhythm;
    }(beepbox.ChangeSequence));
    beepbox.ChangeRhythm = ChangeRhythm;
    var ChangeRhythmNote = (function (_super) {
        __extends(ChangeRhythmNote, _super);
        function ChangeRhythmNote(doc, note, changeRhythm) {
            var _this = _super.call(this, doc, note) || this;
            for (var _i = 0, _a = _this._oldPins; _i < _a.length; _i++) {
                var oldPin = _a[_i];
                _this._newPins.push(beepbox.makeNotePin(oldPin.interval, changeRhythm(oldPin.time + _this._oldStart) - _this._oldStart, oldPin.volume));
            }
            _this._finishSetup();
            return _this;
        }
        return ChangeRhythmNote;
    }(ChangePins));
    beepbox.ChangeRhythmNote = ChangeRhythmNote;
    var ChangeScale = (function (_super) {
        __extends(ChangeScale, _super);
        function ChangeScale(doc, newValue) {
            var _this = _super.call(this) || this;
            if (doc.song.scale != newValue) {
                doc.song.scale = newValue;
                doc.notifier.changed();
                _this._didSomething();
            }
            return _this;
        }
        return ChangeScale;
    }(beepbox.Change));
    beepbox.ChangeScale = ChangeScale;
	
	var ChangeMix = (function (_super) {
        __extends(ChangeMix, _super);
        function ChangeMix(doc, newValue) {
            var _this = _super.call(this) || this;
            if (doc.song.mix != newValue) {
                doc.song.mix = newValue;
                doc.notifier.changed();
                _this._didSomething();
            }
            return _this;
        }
        return ChangeMix;
    }(beepbox.Change));
    beepbox.ChangeMix = ChangeMix;
	
	var ChangeSampleRate = (function (_super) {
        __extends(ChangeSampleRate, _super);
        function ChangeSampleRate(doc, newValue) {
            var _this = _super.call(this) || this;
            if (doc.song.sampleRate != newValue) {
                doc.song.sampleRate = newValue;
                if (!doc.synth.paused) {
                    doc.synth.restartAudio();
                }
                doc.notifier.changed();
                _this._didSomething();
            }
            return _this;
        }
        return ChangeSampleRate;
    }(beepbox.Change));
    beepbox.ChangeSampleRate = ChangeSampleRate;
    beepbox.ChangesampleRate = ChangeSampleRate;
	
	
    var ChangeSong = (function (_super) {
        __extends(ChangeSong, _super);
        function ChangeSong(doc, newHash) {
            var _this = _super.call(this) || this;
            doc.song.fromBase64String(newHash);
            doc.channel = Math.min(doc.channel, doc.song.getChannelCount() - 1);
            doc.bar = Math.max(0, Math.min(doc.song.barCount - 1, doc.bar));
            doc.barScrollPos = Math.max(0, Math.min(doc.song.barCount - doc.trackVisibleBars, doc.barScrollPos));
            doc.barScrollPos = Math.min(doc.bar, Math.max(doc.bar - (doc.trackVisibleBars - 1), doc.barScrollPos));
            doc.notifier.changed();
            _this._didSomething();
            return _this;
        }
        return ChangeSong;
    }(beepbox.Change));
    beepbox.ChangeSong = ChangeSong;
    var ChangeTempo = (function (_super) {
        __extends(ChangeTempo, _super);
        function ChangeTempo(doc, oldValue, newValue) {
            var _this = _super.call(this) || this;
            doc.song.tempo = newValue;
            doc.notifier.changed();
            if (oldValue != newValue)
                _this._didSomething();
            return _this;
        }
        return ChangeTempo;
    }(beepbox.Change));
    beepbox.ChangeTempo = ChangeTempo;
    var ChangeReverb = (function (_super) {
        __extends(ChangeReverb, _super);
        function ChangeReverb(doc, oldValue, newValue) {
            var _this = _super.call(this) || this;
            doc.song.reverb = newValue;
            doc.notifier.changed();
            if (oldValue != newValue)
                _this._didSomething();
            return _this;
        }
        return ChangeReverb;
    }(beepbox.Change));
    beepbox.ChangeReverb = ChangeReverb;
    var ChangeBlend = (function (_super) {
        __extends(ChangeBlend, _super);
        function ChangeBlend(doc, oldValue, newValue) {
            var _this = _super.call(this) || this;
            doc.song.blend = newValue;
            doc.notifier.changed();
            if (oldValue != newValue)
            _this._didSomething();
            return _this;
        }
        return ChangeBlend;
    }(beepbox.Change));
    beepbox.ChangeBlend = ChangeBlend;
    var ChangeRiff = (function (_super) {
        __extends(ChangeRiff, _super);
        function ChangeRiff(doc, oldValue, newValue) {
            var _this = _super.call(this) || this;
            doc.song.riff = newValue;
            doc.notifier.changed();
            if (oldValue != newValue)
                _this._didSomething();
            return _this;
        }
        return ChangeRiff;
    }(beepbox.Change));
    beepbox.ChangeRiff = ChangeRiff;
    var ChangeDetune = (function (_super) {
        __extends(ChangeDetune, _super);
        function ChangeDetune(doc, oldValue, newValue) {
            var _this = _super.call(this) || this;
            doc.song.detune = newValue;
            doc.notifier.changed();
            if (oldValue != newValue)
                _this._didSomething();
            return _this;
        }
        return ChangeDetune;
    }(beepbox.Change));
    beepbox.ChangeDetune = ChangeDetune;
    var ChangeMuff = (function (_super) {
        __extends(ChangeMuff, _super);
        function ChangeMuff(doc, oldValue, newValue) {
            var _this = _super.call(this) || this;
            doc.song.muff = newValue;
            doc.notifier.changed();
            if (oldValue != newValue)
                _this._didSomething();
            return _this;
        }
        return ChangeMuff;
    }(beepbox.Change));
    beepbox.ChangeMuff = ChangeMuff;
    var ChangeNoteAdded = (function (_super) {
        __extends(ChangeNoteAdded, _super);
        function ChangeNoteAdded(doc, pattern, note, index, deletion) {
            if (deletion === void 0) { deletion = false; }
            var _this = _super.call(this, deletion) || this;
            _this._doc = doc;
            _this._pattern = pattern;
            _this._note = note;
            _this._index = index;
            _this._didSomething();
            _this.redo();
            return _this;
        }
        ChangeNoteAdded.prototype._doForwards = function () {
            this._pattern.notes.splice(this._index, 0, this._note);
            this._doc.notifier.changed();
        };
        ChangeNoteAdded.prototype._doBackwards = function () {
            this._pattern.notes.splice(this._index, 1);
            this._doc.notifier.changed();
        };
        return ChangeNoteAdded;
    }(beepbox.UndoableChange));
    beepbox.ChangeNoteAdded = ChangeNoteAdded;
    var ChangeNoteLength = (function (_super) {
        __extends(ChangeNoteLength, _super);
        function ChangeNoteLength(doc, note, truncStart, truncEnd) {
            var _this = _super.call(this, doc, note) || this;
            truncStart -= _this._oldStart;
            truncEnd -= _this._oldStart;
            var setStart = false;
            var prevVolume = _this._oldPins[0].volume;
            var prevInterval = _this._oldPins[0].interval;
            var pushLastPin = true;
            var i;
            for (i = 0; i < _this._oldPins.length; i++) {
                var oldPin = _this._oldPins[i];
                if (oldPin.time < truncStart) {
                    prevVolume = oldPin.volume;
                    prevInterval = oldPin.interval;
                }
                else if (oldPin.time <= truncEnd) {
                    if (oldPin.time > truncStart && !setStart) {
                        _this._newPins.push(beepbox.makeNotePin(prevInterval, truncStart, prevVolume));
                    }
                    _this._newPins.push(beepbox.makeNotePin(oldPin.interval, oldPin.time, oldPin.volume));
                    setStart = true;
                    if (oldPin.time == truncEnd) {
                        pushLastPin = false;
                        break;
                    }
                }
                else {
                    break;
                }
            }
            if (pushLastPin)
                _this._newPins.push(beepbox.makeNotePin(_this._oldPins[i].interval, truncEnd, _this._oldPins[i].volume));
            _this._finishSetup();
            return _this;
        }
        return ChangeNoteLength;
    }(ChangePins));
    beepbox.ChangeNoteLength = ChangeNoteLength;
    var ChangeNoteTruncate = (function (_super) {
        __extends(ChangeNoteTruncate, _super);
        function ChangeNoteTruncate(doc, pattern, start, end, skipNote) {
            var _this = _super.call(this) || this;
            var i = 0;
            while (i < pattern.notes.length) {
                var note = pattern.notes[i];
                if (note == skipNote && skipNote != undefined) {
                    i++;
                }
                else if (note.end <= start) {
                    i++;
                }
                else if (note.start >= end) {
                    break;
                }
                else if (note.start < start) {
                    _this.append(new ChangeNoteLength(doc, note, note.start, start));
                    i++;
                }
                else if (note.end > end) {
                    _this.append(new ChangeNoteLength(doc, note, end, note.end));
                    i++;
                }
                else {
                    _this.append(new ChangeNoteAdded(doc, pattern, note, i, true));
                }
            }
            return _this;
        }
        return ChangeNoteTruncate;
    }(beepbox.ChangeSequence));
    beepbox.ChangeNoteTruncate = ChangeNoteTruncate;
    var ChangeTransposeNote = (function (_super) {
        __extends(ChangeTransposeNote, _super);
        function ChangeTransposeNote(doc, note, upward, octave) {
            var _this = _super.call(this, false) || this;
            _this._doc = doc;
            _this._note = note;
            _this._oldPins = note.pins;
            _this._newPins = [];
            _this._oldPitches = note.pitches;
            _this._newPitches = [];
            if (octave === void 0) { octave = false; }
            var isDrum = doc.song.getChannelIsDrum(doc.channel);
            var maxPitch = (isDrum ? beepbox.Config.drumCount - 1 : beepbox.Config.maxPitch);
            for (var i = 0; i < _this._oldPitches.length; i++) {
                var pitch = _this._oldPitches[i];
                if (octave && !isDrum) {
                    if (upward) {
                        pitch = Math.min(maxPitch, pitch + 12);
                    }
                    else {
                        pitch = Math.max(0, pitch - 12);
                    }
                }
                else if (upward) {
                    for (var j = pitch + 1; j <= maxPitch; j++) {
                        if (isDrum || beepbox.Config.scaleFlags[doc.song.scale][j % 12]) {
                            pitch = j;
                            break;
                        }
                    }
                }
                else {
                    for (var j = pitch - 1; j >= 0; j--) {
                        if (isDrum || beepbox.Config.scaleFlags[doc.song.scale][j % 12]) {
                            pitch = j;
                            break;
                        }
                    }
                }
                var foundMatch = false;
                for (var j = 0; j < _this._newPitches.length; j++) {
                    if (_this._newPitches[j] == pitch) {
                        foundMatch = true;
                        break;
                    }
                }
                if (!foundMatch)
                    _this._newPitches.push(pitch);
            }
            var min = 0;
            var max = maxPitch;
            for (var i = 1; i < _this._newPitches.length; i++) {
                var diff = _this._newPitches[0] - _this._newPitches[i];
                if (min < diff)
                    min = diff;
                if (max > diff + maxPitch)
                    max = diff + maxPitch;
            }
            for (var _i = 0, _a = _this._oldPins; _i < _a.length; _i++) {
                var oldPin = _a[_i];
                var interval = oldPin.interval + _this._oldPitches[0];
                if (interval < min)
                    interval = min;
                if (interval > max)
                    interval = max;
                if (octave && !isDrum) {
                    if (upward) {
                        interval = Math.min(max, interval + 12);
                    }
                    else {
                        interval = Math.max(min, interval - 12);
                    }
                }
                else if (upward) {
                    for (var i = interval + 1; i <= max; i++) {
                        if (isDrum || beepbox.Config.scaleFlags[doc.song.scale][i % 12]) {
                            interval = i;
                            break;
                        }
                    }
                }
                else {
                    for (var i = interval - 1; i >= min; i--) {
                        if (isDrum || beepbox.Config.scaleFlags[doc.song.scale][i % 12]) {
                            interval = i;
                            break;
                        }
                    }
                }
                interval -= _this._newPitches[0];
                _this._newPins.push(beepbox.makeNotePin(interval, oldPin.time, oldPin.volume));
            }
            if (_this._newPins[0].interval != 0)
                throw new Error("wrong pin start interval");
            for (var i = 1; i < _this._newPins.length - 1;) {
                if (_this._newPins[i - 1].interval == _this._newPins[i].interval &&
                    _this._newPins[i].interval == _this._newPins[i + 1].interval &&
                    _this._newPins[i - 1].volume == _this._newPins[i].volume &&
                    _this._newPins[i].volume == _this._newPins[i + 1].volume) {
                    _this._newPins.splice(i, 1);
                }
                else {
                    i++;
                }
            }
            _this._doForwards();
            _this._didSomething();
            return _this;
        }
        ChangeTransposeNote.prototype._doForwards = function () {
            this._note.pins = this._newPins;
            this._note.pitches = this._newPitches;
            this._doc.notifier.changed();
        };
        ChangeTransposeNote.prototype._doBackwards = function () {
            this._note.pins = this._oldPins;
            this._note.pitches = this._oldPitches;
            this._doc.notifier.changed();
        };
        return ChangeTransposeNote;
    }(beepbox.UndoableChange));
    beepbox.ChangeTransposeNote = ChangeTransposeNote;
    var ChangeTranspose = (function (_super) {
        __extends(ChangeTranspose, _super);
        function ChangeTranspose(doc, pattern, upward, octave) {
            var _this = _super.call(this) || this;
            if (octave === void 0) { octave = false; }
            for (var i = 0; i < pattern.notes.length; i++) {
                _this.append(new ChangeTransposeNote(doc, pattern.notes[i], upward, octave));
            }
            return _this;
        }
        return ChangeTranspose;
    }(beepbox.ChangeSequence));
    beepbox.ChangeTranspose = ChangeTranspose;
    var ChangeVolume = (function (_super) {
        __extends(ChangeVolume, _super);
        function ChangeVolume(doc, oldValue, newValue) {
            var _this = _super.call(this) || this;
            doc.song.channels[doc.channel].instruments[doc.getCurrentInstrument()].volume = newValue;
            doc.notifier.changed();
            if (oldValue != newValue)
                _this._didSomething();
            return _this;
        }
        return ChangeVolume;
    }(beepbox.Change));
    beepbox.ChangeVolume = ChangeVolume;
    var ChangeVolumeBend = (function (_super) {
        __extends(ChangeVolumeBend, _super);
        function ChangeVolumeBend(doc, note, bendPart, bendVolume, bendInterval) {
            var _this = _super.call(this, false) || this;
            _this._doc = doc;
            _this._note = note;
            _this._oldPins = note.pins;
            _this._newPins = [];
            var inserted = false;
            for (var _i = 0, _a = note.pins; _i < _a.length; _i++) {
                var pin = _a[_i];
                if (pin.time < bendPart) {
                    _this._newPins.push(pin);
                }
                else if (pin.time == bendPart) {
                    _this._newPins.push(beepbox.makeNotePin(bendInterval, bendPart, bendVolume));
                    inserted = true;
                }
                else {
                    if (!inserted) {
                        _this._newPins.push(beepbox.makeNotePin(bendInterval, bendPart, bendVolume));
                        inserted = true;
                    }
                    _this._newPins.push(pin);
                }
            }
            for (var i = 1; i < _this._newPins.length - 1;) {
                if (_this._newPins[i - 1].interval == _this._newPins[i].interval &&
                    _this._newPins[i].interval == _this._newPins[i + 1].interval &&
                    _this._newPins[i - 1].volume == _this._newPins[i].volume &&
                    _this._newPins[i].volume == _this._newPins[i + 1].volume) {
                    _this._newPins.splice(i, 1);
                }
                else {
                    i++;
                }
            }
            _this._doForwards();
            _this._didSomething();
            return _this;
        }
        ChangeVolumeBend.prototype._doForwards = function () {
            this._note.pins = this._newPins;
            this._doc.notifier.changed();
        };
        ChangeVolumeBend.prototype._doBackwards = function () {
            this._note.pins = this._oldPins;
            this._doc.notifier.changed();
        };
        return ChangeVolumeBend;
    }(beepbox.UndoableChange));
    beepbox.ChangeVolumeBend = ChangeVolumeBend;
    var ChangeWave = (function (_super) {
        __extends(ChangeWave, _super);
        function ChangeWave(doc, newValue) {
            var _this = _super.call(this) || this;
            if (doc.song.channels[doc.channel].instruments[doc.getCurrentInstrument()].wave != newValue) {
                doc.song.channels[doc.channel].instruments[doc.getCurrentInstrument()].wave = newValue;
                doc.notifier.changed();
                _this._didSomething();
            }
            return _this;
        }
        return ChangeWave;
    }(beepbox.Change));
    beepbox.ChangeWave = ChangeWave;
})(beepbox || (beepbox = {}));
// Pattern editing surface and note interaction logic.
var beepbox;
(function (beepbox) {
    function prettyNumber(value) {
        return value.toFixed(2).replace(/\.?0*$/, "");
    }
    function makeEmptyReplacementElement(node) {
        var clone = node.cloneNode(false);
        node.parentNode.replaceChild(clone, node);
        return clone;
    }
    var PatternCursor = (function () {
        function PatternCursor() {
            this.valid = false;
            this.prevNote = null;
            this.curNote = null;
            this.nextNote = null;
            this.pitch = 0;
            this.pitchIndex = -1;
            this.curIndex = 0;
            this.start = 0;
            this.end = 0;
            this.part = 0;
            this.notePart = 0;
            this.nearPinIndex = 0;
            this.pins = [];
        }
        return PatternCursor;
    }());
    var PatternEditor = (function () {
        function PatternEditor(_doc) {
            var _this = this;
            this._doc = _doc;
            this._svgNoteBackground = beepbox.svgElement("pattern", { id: "patternEditorNoteBackground", x: "0", y: "0", width: "64", height: "156", patternUnits: "userSpaceOnUse" });
            this._svgDrumBackground = beepbox.svgElement("pattern", { id: "patternEditorDrumBackground", x: "0", y: "0", width: "64", height: "40", patternUnits: "userSpaceOnUse" });
            this._svgBackground = beepbox.svgElement("rect", { x: "0", y: "0", width: "512", height: "481", "pointer-events": "none", fill: "url(#patternEditorNoteBackground)" });
            this._svgNoteContainer = beepbox.svgElement("svg");
            this._svgPlayhead = beepbox.svgElement("rect", { id: "", x: "0", y: "0", width: "4", height: "481", fill: "white", "pointer-events": "none" });
            this._svgPreview = beepbox.svgElement("path", { fill: "none", stroke: "white", "stroke-width": "2", "pointer-events": "none" });
            this._svg = beepbox.svgElement("svg", { style: "background-color: #000000; touch-action: none; position: absolute;", width: "100%", height: "100%", viewBox: "0 0 512 481", preserveAspectRatio: "none" }, [
                beepbox.svgElement("defs", undefined, [
                    this._svgNoteBackground,
                    this._svgDrumBackground,
                ]),
                this._svgBackground,
                this._svgNoteContainer,
                this._svgPreview,
                this._svgPlayhead,
            ]);
            this.container = beepbox.html.div({ style: "height: 100%; overflow:hidden; position: relative; flex-grow: 1;" }, [this._svg]);
            this._defaultPitchHeight = 13;
            this._defaultDrumHeight = 40;
            this._backgroundPitchRows = [];
            this._backgroundDrumRow = beepbox.svgElement("rect");
            this._defaultPinChannels = [
                [beepbox.makeNotePin(0, 0, 3), beepbox.makeNotePin(0, 2, 3)],
                [beepbox.makeNotePin(0, 0, 3), beepbox.makeNotePin(0, 2, 3)],
                [beepbox.makeNotePin(0, 0, 3), beepbox.makeNotePin(0, 2, 3)],
                [beepbox.makeNotePin(0, 0, 3), beepbox.makeNotePin(0, 2, 3)],
                [beepbox.makeNotePin(0, 0, 3), beepbox.makeNotePin(0, 2, 0)]
            ];
            this._editorHeight = 481;
            this._mouseX = 0;
            this._mouseY = 0;
            this._mouseDown = false;
            this._mouseOver = false;
            this._mouseDragging = false;
            this._mouseHorizontal = false;
            this._usingTouch = false;
            this._copiedPinChannels = [];
            this._mouseXStart = 0;
            this._mouseYStart = 0;
            this._mouseXPrev = 0;
            this._mouseYPrev = 0;
            this._dragTime = 0;
            this._dragPitch = 0;
            this._dragVolume = 0;
            this._dragVisible = false;
            this._dragChange = null;
            this._cursor = new PatternCursor();
            this._pattern = null;
            this._playheadX = 0.0;
            this._octaveOffset = 0;
            this._renderedWidth = -1;
            this._renderedBeatWidth = -1;
            this._renderedFifths = false;
            this._renderedAdvancedColors = false;
            this._renderedDrums = false;
            this._renderedPartsPerBeat = -1;
            this._renderedPitchChannelCount = -1;
            this._renderedDrumChannelCount = -1;
            this._followPlayheadBar = -1;
            this.resetCopiedPins = function () {
                var maxDivision = _this._getMaxDivision();
                _this._copiedPinChannels.length = _this._doc.song.getChannelCount();
                for (var i = 0; i < _this._doc.song.pitchChannelCount; i++) {
                    _this._copiedPinChannels[i] = [beepbox.makeNotePin(0, 0, 3), beepbox.makeNotePin(0, maxDivision, 3)];
                }
                for (var i = _this._doc.song.pitchChannelCount; i < _this._doc.song.getChannelCount(); i++) {
                    _this._copiedPinChannels[i] = [beepbox.makeNotePin(0, 0, 3), beepbox.makeNotePin(0, maxDivision, 0)];
                }
            };
            this._animatePlayhead = function (timestamp) {
                var playheadBar = Math.floor(_this._doc.synth.playhead);
                if (!_this._doc.synth.playing || _this._pattern == null || _this._doc.song.getPattern(_this._doc.channel, Math.floor(_this._doc.synth.playhead)) != _this._pattern) {
                    _this._svgPlayhead.setAttribute("visibility", "hidden");
                }
                else {
                    _this._svgPlayhead.setAttribute("visibility", "visible");
                    var modPlayhead = _this._doc.synth.playhead - playheadBar;
                    if (Math.abs(modPlayhead - _this._playheadX) > 0.1) {
                        _this._playheadX = modPlayhead;
                    }
                    else {
                        _this._playheadX += (modPlayhead - _this._playheadX) * 0.2;
                    }
                    _this._svgPlayhead.setAttribute("x", "" + prettyNumber(_this._playheadX * _this._editorWidth - 2));
                }
                if (_this._doc.synth.playing && _this._doc.autoFollow && _this._followPlayheadBar != playheadBar) {
                    new beepbox.ChangeChannelBar(_this._doc, _this._doc.channel, playheadBar);
                    _this._doc.notifier.notifyWatchers();
                }
                _this._followPlayheadBar = playheadBar;
                window.requestAnimationFrame(_this._animatePlayhead);
            };
            this._whenMouseOver = function (event) {
                if (_this._mouseOver)
                    return;
                _this._mouseOver = true;
                _this._usingTouch = false;
            };
            this._whenMouseOut = function (event) {
                if (!_this._mouseOver)
                    return;
                _this._mouseOver = false;
            };
            this._whenMousePressed = function (event) {
                event.preventDefault();
                var boundingRect = _this._svg.getBoundingClientRect();
                _this._mouseX = ((event.clientX || event.pageX) - boundingRect.left) * _this._editorWidth / (boundingRect.right - boundingRect.left);
                _this._mouseY = ((event.clientY || event.pageY) - boundingRect.top) * _this._editorHeight / (boundingRect.bottom - boundingRect.top);
                if (isNaN(_this._mouseX))
                    _this._mouseX = 0;
                if (isNaN(_this._mouseY))
                    _this._mouseY = 0;
                _this._usingTouch = false;
                _this._whenCursorPressed();
            };
            this._whenTouchPressed = function (event) {
                event.preventDefault();
                var boundingRect = _this._svg.getBoundingClientRect();
                _this._mouseX = (event.touches[0].clientX - boundingRect.left) * _this._editorWidth / (boundingRect.right - boundingRect.left);
                _this._mouseY = (event.touches[0].clientY - boundingRect.top) * _this._editorHeight / (boundingRect.bottom - boundingRect.top);
                if (isNaN(_this._mouseX))
                    _this._mouseX = 0;
                if (isNaN(_this._mouseY))
                    _this._mouseY = 0;
                _this._usingTouch = true;
                _this._whenCursorPressed();
            };
            this._whenMouseMoved = function (event) {
                var boundingRect = _this._svg.getBoundingClientRect();
                _this._mouseX = ((event.clientX || event.pageX) - boundingRect.left) * _this._editorWidth / (boundingRect.right - boundingRect.left);
                _this._mouseY = ((event.clientY || event.pageY) - boundingRect.top) * _this._editorHeight / (boundingRect.bottom - boundingRect.top);
                if (isNaN(_this._mouseX))
                    _this._mouseX = 0;
                if (isNaN(_this._mouseY))
                    _this._mouseY = 0;
                _this._usingTouch = false;
                _this._whenCursorMoved();
            };
            this._whenTouchMoved = function (event) {
                if (!_this._mouseDown)
                    return;
                event.preventDefault();
                var boundingRect = _this._svg.getBoundingClientRect();
                _this._mouseX = (event.touches[0].clientX - boundingRect.left) * _this._editorWidth / (boundingRect.right - boundingRect.left);
                _this._mouseY = (event.touches[0].clientY - boundingRect.top) * _this._editorHeight / (boundingRect.bottom - boundingRect.top);
                if (isNaN(_this._mouseX))
                    _this._mouseX = 0;
                if (isNaN(_this._mouseY))
                    _this._mouseY = 0;
                _this._whenCursorMoved();
            };
            this._whenCursorReleased = function (event) {
                if (!_this._cursor.valid)
                    return;
                var continuousState = _this._doc.lastChangeWas(_this._dragChange);
                if (_this._mouseDragging && continuousState) {
                    if (_this._dragChange != null) {
                        _this._doc.record(_this._dragChange);
                        _this._dragChange = null;
                    }
                }
                else if (_this._mouseDown && continuousState) {
                    if (_this._cursor.curNote == null) {
                        var note = beepbox.makeNote(_this._cursor.pitch, _this._cursor.start, _this._cursor.end, 3, _this._doc.song.getChannelIsDrum(_this._doc.channel));
                        note.pins = [];
                        for (var _i = 0, _a = _this._cursor.pins; _i < _a.length; _i++) {
                            var oldPin = _a[_i];
                            note.pins.push(beepbox.makeNotePin(0, oldPin.time, oldPin.volume));
                        }
                        var sequence = new beepbox.ChangeSequence();
                        var pattern = _this._ensurePatternExists(sequence);
                        if (pattern != null) {
                            sequence.append(new beepbox.ChangeNoteAdded(_this._doc, pattern, note, _this._cursor.curIndex));
                            _this._doc.record(sequence);
                            _this._pattern = pattern;
                        }
                    }
                    else {
                        if (_this._cursor.pitchIndex == -1) {
                            var sequence = new beepbox.ChangeSequence();
                            if (_this._cursor.curNote.pitches.length == 4) {
                                sequence.append(new beepbox.ChangePitchAdded(_this._doc, _this._cursor.curNote, _this._cursor.curNote.pitches[0], 0, true));
                            }
                            sequence.append(new beepbox.ChangePitchAdded(_this._doc, _this._cursor.curNote, _this._cursor.pitch, _this._cursor.curNote.pitches.length));
                            _this._doc.record(sequence);
                            _this._copyPins(_this._cursor.curNote);
                        }
                        else {
                            if (_this._cursor.curNote.pitches.length == 1) {
                                _this._doc.record(new beepbox.ChangeNoteAdded(_this._doc, _this._pattern, _this._cursor.curNote, _this._cursor.curIndex, true));
                            }
                            else {
                                _this._doc.record(new beepbox.ChangePitchAdded(_this._doc, _this._cursor.curNote, _this._cursor.pitch, _this._cursor.curNote.pitches.indexOf(_this._cursor.pitch), true));
                            }
                        }
                    }
                }
                _this._mouseDown = false;
                _this._mouseDragging = false;
                _this._updateCursorStatus();
                _this._updatePreview();
            };
            this._documentChanged = function () {
                _this._editorWidth = _this._doc.showLetters ? (_this._doc.showScrollBar ? 460 : 480) : (_this._doc.showScrollBar ? 492 : 512);
                _this._pattern = _this._doc.getCurrentPattern();
                _this._partWidth = _this._editorWidth / (_this._doc.song.beatsPerBar * _this._doc.song.partsPerBeat);
                _this._pitchHeight = _this._doc.song.getChannelIsDrum(_this._doc.channel) ? _this._defaultDrumHeight : _this._defaultPitchHeight;
                _this._pitchCount = _this._doc.song.getChannelIsDrum(_this._doc.channel) ? beepbox.Config.drumCount : beepbox.Config.pitchCount;
                _this._octaveOffset = _this._doc.song.channels[_this._doc.channel].octave * 12;
                if (_this._renderedPartsPerBeat != _this._doc.song.partsPerBeat ||
                    _this._renderedPitchChannelCount != _this._doc.song.pitchChannelCount ||
                    _this._renderedDrumChannelCount != _this._doc.song.drumChannelCount) {
                    _this._renderedPartsPerBeat = _this._doc.song.partsPerBeat;
                    _this._renderedPitchChannelCount = _this._doc.song.pitchChannelCount;
                    _this._renderedDrumChannelCount = _this._doc.song.drumChannelCount;
                    _this.resetCopiedPins();
                }
                _this._copiedPins = _this._copiedPinChannels[_this._doc.channel];
                if (_this._renderedWidth != _this._editorWidth) {
                    _this._renderedWidth = _this._editorWidth;
                    _this._svg.setAttribute("viewBox", "0 0 " + _this._editorWidth + " 481");
                    _this._svgBackground.setAttribute("width", "" + _this._editorWidth);
                }
                var beatWidth = _this._editorWidth / _this._doc.song.beatsPerBar;
                if (_this._renderedBeatWidth != beatWidth) {
                    _this._renderedBeatWidth = beatWidth;
                    _this._svgNoteBackground.setAttribute("width", "" + beatWidth);
                    _this._svgDrumBackground.setAttribute("width", "" + beatWidth);
                    _this._backgroundDrumRow.setAttribute("width", "" + (beatWidth - 2));
                    for (var j = 0; j < 12; j++) {
                        _this._backgroundPitchRows[j].setAttribute("width", "" + (beatWidth - 2));
                    }
                }
                if (!_this._mouseDown)
                    _this._updateCursorStatus();
                _this._svgNoteContainer = makeEmptyReplacementElement(_this._svgNoteContainer);
                _this._updatePreview();
                if (_this._renderedFifths != _this._doc.showFifth) {
                    _this._renderedFifths = _this._doc.showFifth;
					if (_this._doc.song.theme != 19) {
					_this._backgroundPitchRows[7].setAttribute("fill", _this._doc.showFifth ? fifthNoteColorPallet[_this._doc.song.theme] : "#444444");
					}
					else {
					_this._backgroundPitchRows[7].setAttribute("fill", _this._doc.showFifth ? noteFive[_this._doc.song.key] : "#444444");
					}
				}
				
				if (_this._renderedAdvancedColors != _this._doc.showAdvancedColors) {
					if (_this._doc.song.theme != 19) {
					_this._renderedAdvancedColors = _this._doc.showAdvancedColors;
                    _this._backgroundPitchRows[1].setAttribute("fill", _this._doc.showAdvancedColors ? secondNoteColorPallet[_this._doc.song.theme] : "#444444");
					_this._backgroundPitchRows[2].setAttribute("fill", _this._doc.showAdvancedColors ? thirdNoteColorPallet[_this._doc.song.theme] : "#444444");
					_this._backgroundPitchRows[3].setAttribute("fill", _this._doc.showAdvancedColors ? fourthNoteColorPallet[_this._doc.song.theme] : "#444444");
					_this._backgroundPitchRows[4].setAttribute("fill", _this._doc.showAdvancedColors ? sixthNoteColorPallet[_this._doc.song.theme] : "#444444");
					_this._backgroundPitchRows[5].setAttribute("fill", _this._doc.showAdvancedColors ? seventhNoteColorPallet[_this._doc.song.theme] : "#444444");
					_this._backgroundPitchRows[6].setAttribute("fill", _this._doc.showAdvancedColors ? eigthNoteColorPallet[_this._doc.song.theme] : "#444444");
					_this._backgroundPitchRows[8].setAttribute("fill", _this._doc.showAdvancedColors ? ninthNoteColorPallet[_this._doc.song.theme] : "#444444");
					_this._backgroundPitchRows[9].setAttribute("fill", _this._doc.showAdvancedColors ? tenNoteColorPallet[_this._doc.song.theme] : "#444444");
					_this._backgroundPitchRows[10].setAttribute("fill", _this._doc.showAdvancedColors ? elevenNoteColorPallet[_this._doc.song.theme] : "#444444");
					_this._backgroundPitchRows[11].setAttribute("fill", _this._doc.showAdvancedColors ? twelveNoteColorPallet[_this._doc.song.theme] : "#444444");
					}
					else {
					_this._renderedAdvancedColors = _this._doc.showAdvancedColors;
                    _this._backgroundPitchRows[1].setAttribute("fill", _this._doc.showAdvancedColors ? noteTwo[_this._doc.song.key] : "#444444");
					_this._backgroundPitchRows[2].setAttribute("fill", _this._doc.showAdvancedColors ? noteThree[_this._doc.song.key] : "#444444");
					_this._backgroundPitchRows[3].setAttribute("fill", _this._doc.showAdvancedColors ? noteFour[_this._doc.song.key] : "#444444");
					_this._backgroundPitchRows[4].setAttribute("fill", _this._doc.showAdvancedColors ? noteSix[_this._doc.song.key] : "#444444");
					_this._backgroundPitchRows[5].setAttribute("fill", _this._doc.showAdvancedColors ? noteSeven[_this._doc.song.key] : "#444444");
					_this._backgroundPitchRows[6].setAttribute("fill", _this._doc.showAdvancedColors ? noteEight[_this._doc.song.key] : "#444444");
					_this._backgroundPitchRows[8].setAttribute("fill", _this._doc.showAdvancedColors ? noteNine[_this._doc.song.key] : "#444444");
					_this._backgroundPitchRows[9].setAttribute("fill", _this._doc.showAdvancedColors ? noteTen[_this._doc.song.key] : "#444444");
					_this._backgroundPitchRows[10].setAttribute("fill", _this._doc.showAdvancedColors ? noteEleven[_this._doc.song.key] : "#444444");
					_this._backgroundPitchRows[11].setAttribute("fill", _this._doc.showAdvancedColors ? noteTwelve[_this._doc.song.key] : "#444444");
					}
				}
                for (var j = 0; j < 12; j++) {
                    _this._backgroundPitchRows[j].style.visibility = beepbox.Config.scaleFlags[_this._doc.song.scale][j] ? "visible" : "hidden";
                }
                if (_this._doc.song.getChannelIsDrum(_this._doc.channel)) {
                    if (!_this._renderedDrums) {
                        _this._renderedDrums = true;
                        _this._svgBackground.setAttribute("fill", "url(#patternEditorDrumBackground)");
                        _this._svgBackground.setAttribute("height", "" + (_this._defaultDrumHeight * beepbox.Config.drumCount));
                    }
                }
                else {
                    if (_this._renderedDrums) {
                        _this._renderedDrums = false;
                        _this._svgBackground.setAttribute("fill", "url(#patternEditorNoteBackground)");
                        _this._svgBackground.setAttribute("height", "" + _this._editorHeight);
                    }
                }
                if (_this._doc.showChannels) {
                    for (var channel = _this._doc.song.getChannelCount() - 1; channel >= 0; channel--) {
                        if (channel == _this._doc.channel)
                            continue;
                        if (_this._doc.song.getChannelIsDrum(channel) != _this._doc.song.getChannelIsDrum(_this._doc.channel))
                            continue;
                        var pattern2 = _this._doc.song.getPattern(channel, _this._doc.bar);
                        if (pattern2 == null)
                            continue;
                        for (var _i = 0, _a = pattern2.notes; _i < _a.length; _i++) {
                            var note = _a[_i];
                            for (var _b = 0, _c = note.pitches; _b < _c.length; _b++) {
                                var pitch = _c[_b];
                                var notePath = beepbox.svgElement("path");
                                notePath.setAttribute("fill", _this._doc.song.getNoteColorDim(channel));
                                notePath.setAttribute("pointer-events", "none");
                                _this._drawNote(notePath, pitch, note.start, note.pins, _this._pitchHeight * 0.19, false, _this._doc.song.channels[channel].octave * 12);
                                _this._svgNoteContainer.appendChild(notePath);
                            }
                        }
                    }
                }
                if (_this._pattern != null) {
                    for (var _d = 0, _e = _this._pattern.notes; _d < _e.length; _d++) {
                        var note = _e[_d];
                        for (var i = 0; i < note.pitches.length; i++) {
                            var pitch = note.pitches[i];
                            var notePath = beepbox.svgElement("path");
                            notePath.setAttribute("fill", _this._doc.song.getNoteColorDim(_this._doc.channel));
                            notePath.setAttribute("pointer-events", "none");
                            _this._drawNote(notePath, pitch, note.start, note.pins, _this._pitchHeight / 2 + 1, false, _this._octaveOffset);
                            _this._svgNoteContainer.appendChild(notePath);
                            notePath = beepbox.svgElement("path");
                            notePath.setAttribute("fill", _this._doc.song.getNoteColorBright(_this._doc.channel));
                            notePath.setAttribute("pointer-events", "none");
                            _this._drawNote(notePath, pitch, note.start, note.pins, _this._pitchHeight / 2 + 1, true, _this._octaveOffset);
                            _this._svgNoteContainer.appendChild(notePath);
                            if (note.pitches.length > 1) {
                                var instrumentType = _this._doc.song.channels[_this._doc.channel].instruments[_this._doc.getCurrentInstrument()].type;
                                    var oscillatorLabel = beepbox.svgElement("text");
                                    oscillatorLabel.setAttribute("x", "" + prettyNumber(_this._partWidth * note.start + 2));
                                    oscillatorLabel.setAttribute("y", "" + prettyNumber(_this._pitchToPixelHeight(pitch - _this._octaveOffset)));
                                    oscillatorLabel.setAttribute("width", "30");
                                    oscillatorLabel.setAttribute("fill", "black");
                                    oscillatorLabel.setAttribute("text-anchor", "start");
                                    oscillatorLabel.setAttribute("dominant-baseline", "central");
                                    oscillatorLabel.setAttribute("pointer-events", "none");
                                    oscillatorLabel.textContent = "" + (i + 1);
                                    _this._svgNoteContainer.appendChild(oscillatorLabel);
                            }
                        }
                    }
                    _this._svgBackground.style.visibility = "visible";
                }
                else {
                    _this._svgBackground.style.visibility = "visible";
                }
            };
            for (var i = 0; i < 12; i++) {
                var y = (12 - i) % 12;
                var rectangle = beepbox.svgElement("rect");
                rectangle.setAttribute("x", "1");
                rectangle.setAttribute("y", "" + (y * this._defaultPitchHeight + 1));
                rectangle.setAttribute("height", "" + (this._defaultPitchHeight - 2));
                rectangle.setAttribute("fill", (i == 0) ? baseNoteColorPallet[_this._doc.song.theme] : "#444444");
                this._svgNoteBackground.appendChild(rectangle);
                this._backgroundPitchRows[i] = rectangle;
            }
            this._backgroundDrumRow.setAttribute("x", "1");
            this._backgroundDrumRow.setAttribute("y", "1");
            this._backgroundDrumRow.setAttribute("height", "" + (this._defaultDrumHeight - 2));
            this._backgroundDrumRow.setAttribute("fill", "#444444");
            this._svgDrumBackground.appendChild(this._backgroundDrumRow);
            this._doc.notifier.watch(this._documentChanged);
            this._documentChanged();
            this._updateCursorStatus();
            this._updatePreview();
            window.requestAnimationFrame(this._animatePlayhead);
            this._svg.addEventListener("mousedown", this._whenMousePressed);
            document.addEventListener("mousemove", this._whenMouseMoved);
            document.addEventListener("mouseup", this._whenCursorReleased);
            this._svg.addEventListener("mouseover", this._whenMouseOver);
            this._svg.addEventListener("mouseout", this._whenMouseOut);
            this._svg.addEventListener("touchstart", this._whenTouchPressed);
            this._svg.addEventListener("touchmove", this._whenTouchMoved);
            this._svg.addEventListener("touchend", this._whenCursorReleased);
            this._svg.addEventListener("touchcancel", this._whenCursorReleased);
            this.resetCopiedPins();
        }
        PatternEditor.prototype._getMaxDivision = function () {
            if (this._doc.song.partsPerBeat % 3 == 0) {
                return this._doc.song.partsPerBeat / 3;
            }
            else if (this._doc.song.partsPerBeat % 2 == 0) {
                return this._doc.song.partsPerBeat / 2;
            }
            return this._doc.song.partsPerBeat;
        };
        PatternEditor.prototype._updateCursorStatus = function () {
            this._cursor = new PatternCursor();
            if (this._mouseX < 0 || this._mouseX > this._editorWidth || this._mouseY < 0 || this._mouseY > this._editorHeight)
                return;
            this._cursor.part = Math.floor(Math.max(0, Math.min(this._doc.song.beatsPerBar * this._doc.song.partsPerBeat - 1, this._mouseX / this._partWidth)));
            var pattern = this._pattern;
            var notes = pattern == null ? [] : pattern.notes;
            for (var _i = 0, _a = notes; _i < _a.length; _i++) {
                var note = _a[_i];
                if (note.end <= this._cursor.part) {
                    this._cursor.prevNote = note;
                    this._cursor.curIndex++;
                }
                else if (note.start <= this._cursor.part && note.end > this._cursor.part) {
                    this._cursor.curNote = note;
                }
                else if (note.start > this._cursor.part) {
                    this._cursor.nextNote = note;
                    break;
                }
            }
            var mousePitch = this._findMousePitch(this._mouseY);
            if (this._cursor.curNote != null) {
                this._cursor.start = this._cursor.curNote.start;
                this._cursor.end = this._cursor.curNote.end;
                this._cursor.pins = this._cursor.curNote.pins;
                var interval = 0;
                var error = 0;
                var prevPin = void 0;
                var nextPin = this._cursor.curNote.pins[0];
                for (var j = 1; j < this._cursor.curNote.pins.length; j++) {
                    prevPin = nextPin;
                    nextPin = this._cursor.curNote.pins[j];
                    var leftSide = this._partWidth * (this._cursor.curNote.start + prevPin.time);
                    var rightSide = this._partWidth * (this._cursor.curNote.start + nextPin.time);
                    if (this._mouseX > rightSide)
                        continue;
                    if (this._mouseX < leftSide)
                        throw new Error();
                    var intervalRatio = (this._mouseX - leftSide) / (rightSide - leftSide);
                    var arc = Math.sqrt(1.0 / Math.sqrt(4.0) - Math.pow(intervalRatio - 0.5, 2.0)) - 0.5;
                    var bendHeight = Math.abs(nextPin.interval - prevPin.interval);
                    interval = prevPin.interval * (1.0 - intervalRatio) + nextPin.interval * intervalRatio;
                    error = arc * bendHeight + 1.0;
                    break;
                }
                var minInterval = Number.MAX_VALUE;
                var maxInterval = -Number.MAX_VALUE;
                var bestDistance = Number.MAX_VALUE;
                for (var _b = 0, _c = this._cursor.curNote.pins; _b < _c.length; _b++) {
                    var pin = _c[_b];
                    if (minInterval > pin.interval)
                        minInterval = pin.interval;
                    if (maxInterval < pin.interval)
                        maxInterval = pin.interval;
                    var pinDistance = Math.abs(this._cursor.curNote.start + pin.time - this._mouseX / this._partWidth);
                    if (bestDistance > pinDistance) {
                        bestDistance = pinDistance;
                        this._cursor.nearPinIndex = this._cursor.curNote.pins.indexOf(pin);
                    }
                }
                mousePitch -= interval;
                this._cursor.pitch = this._snapToPitch(mousePitch, -minInterval, (this._doc.song.getChannelIsDrum(this._doc.channel) ? beepbox.Config.drumCount - 1 : beepbox.Config.maxPitch) - maxInterval);
                if (this._doc.channel != 3) {
                    var nearest = error;
                    for (var i = 0; i < this._cursor.curNote.pitches.length; i++) {
                        var distance = Math.abs(this._cursor.curNote.pitches[i] - mousePitch + 0.5);
                        if (distance > nearest)
                            continue;
                        nearest = distance;
                        this._cursor.pitch = this._cursor.curNote.pitches[i];
                    }
                }
                for (var i = 0; i < this._cursor.curNote.pitches.length; i++) {
                    if (this._cursor.curNote.pitches[i] == this._cursor.pitch) {
                        this._cursor.pitchIndex = i;
                        break;
                    }
                }
            }
            else {
                this._cursor.pitch = this._snapToPitch(mousePitch, 0, beepbox.Config.maxPitch);
                var defaultLength = this._copiedPins[this._copiedPins.length - 1].time;
                var fullBeats = Math.floor(this._cursor.part / this._doc.song.partsPerBeat);
                var maxDivision = this._getMaxDivision();
                var modMouse = this._cursor.part % this._doc.song.partsPerBeat;
                if (defaultLength == 1) {
                    this._cursor.start = this._cursor.part;
                }
                else if (defaultLength > this._doc.song.partsPerBeat) {
                    this._cursor.start = fullBeats * this._doc.song.partsPerBeat;
                }
                else if (defaultLength == this._doc.song.partsPerBeat) {
                    this._cursor.start = fullBeats * this._doc.song.partsPerBeat;
                    if (maxDivision < this._doc.song.partsPerBeat && modMouse > maxDivision) {
                        this._cursor.start += Math.floor(modMouse / maxDivision) * maxDivision;
                    }
                }
                else {
                    this._cursor.start = fullBeats * this._doc.song.partsPerBeat;
                    var division = this._doc.song.partsPerBeat % defaultLength == 0 ? defaultLength : Math.min(defaultLength, maxDivision);
                    while (division < maxDivision && this._doc.song.partsPerBeat % division != 0) {
                        division++;
                    }
                    this._cursor.start += Math.floor(modMouse / division) * division;
                }
                this._cursor.end = this._cursor.start + defaultLength;
                var forceStart = 0;
                var forceEnd = this._doc.song.beatsPerBar * this._doc.song.partsPerBeat;
                if (this._cursor.prevNote != null) {
                    forceStart = this._cursor.prevNote.end;
                }
                if (this._cursor.nextNote != null) {
                    forceEnd = this._cursor.nextNote.start;
                }
                if (this._cursor.start < forceStart) {
                    this._cursor.start = forceStart;
                    this._cursor.end = this._cursor.start + defaultLength;
                    if (this._cursor.end > forceEnd) {
                        this._cursor.end = forceEnd;
                    }
                }
                else if (this._cursor.end > forceEnd) {
                    this._cursor.end = forceEnd;
                    this._cursor.start = this._cursor.end - defaultLength;
                    if (this._cursor.start < forceStart) {
                        this._cursor.start = forceStart;
                    }
                }
                if (this._cursor.end - this._cursor.start == defaultLength) {
                    this._cursor.pins = this._copiedPins;
                }
                else {
                    this._cursor.pins = [];
                    for (var _d = 0, _e = this._copiedPins; _d < _e.length; _d++) {
                        var oldPin = _e[_d];
                        if (oldPin.time <= this._cursor.end - this._cursor.start) {
                            this._cursor.pins.push(beepbox.makeNotePin(0, oldPin.time, oldPin.volume));
                            if (oldPin.time == this._cursor.end - this._cursor.start)
                                break;
                        }
                        else {
                            this._cursor.pins.push(beepbox.makeNotePin(0, this._cursor.end - this._cursor.start, oldPin.volume));
                            break;
                        }
                    }
                }
            }
            this._cursor.valid = true;
        };
        PatternEditor.prototype._findMousePitch = function (pixelY) {
            return Math.max(0, Math.min(this._pitchCount - 1, this._pitchCount - (pixelY / this._pitchHeight))) + this._octaveOffset;
        };
        PatternEditor.prototype._snapToPitch = function (guess, min, max) {
            if (guess < min)
                guess = min;
            if (guess > max)
                guess = max;
            var scale = beepbox.Config.scaleFlags[this._doc.song.scale];
            if (scale[Math.floor(guess) % 12] || this._doc.song.getChannelIsDrum(this._doc.channel)) {
                return Math.floor(guess);
            }
            else {
                var topPitch = Math.floor(guess) + 1;
                var bottomPitch = Math.floor(guess) - 1;
                while (!scale[topPitch % 12]) {
                    topPitch++;
                }
                while (!scale[(bottomPitch) % 12]) {
                    bottomPitch--;
                }
                if (topPitch > max) {
                    if (bottomPitch < min) {
                        return min;
                    }
                    else {
                        return bottomPitch;
                    }
                }
                else if (bottomPitch < min) {
                    return topPitch;
                }
                var topRange = topPitch;
                var bottomRange = bottomPitch + 1;
                if (topPitch % 12 == 0 || topPitch % 12 == 7) {
                    topRange -= 0.5;
                }
                if (bottomPitch % 12 == 0 || bottomPitch % 12 == 7) {
                    bottomRange += 0.5;
                }
                return guess - bottomRange > topRange - guess ? topPitch : bottomPitch;
            }
        };
        PatternEditor.prototype._copyPins = function (note) {
            this._copiedPins = [];
            for (var _i = 0, _a = note.pins; _i < _a.length; _i++) {
                var oldPin = _a[_i];
                this._copiedPins.push(beepbox.makeNotePin(0, oldPin.time, oldPin.volume));
            }
            for (var i = 1; i < this._copiedPins.length - 1;) {
                if (this._copiedPins[i - 1].volume == this._copiedPins[i].volume &&
                    this._copiedPins[i].volume == this._copiedPins[i + 1].volume) {
                    this._copiedPins.splice(i, 1);
                }
                else {
                    i++;
                }
            }
            this._copiedPinChannels[this._doc.channel] = this._copiedPins;
        };
        PatternEditor.prototype._whenCursorPressed = function () {
            this._mouseDown = true;
            this._mouseXStart = this._mouseX;
            this._mouseYStart = this._mouseY;
            this._mouseXPrev = this._mouseX;
            this._mouseYPrev = this._mouseY;
            this._updateCursorStatus();
            this._updatePreview();
            this._dragChange = new beepbox.ChangeSequence();
            this._doc.setProspectiveChange(this._dragChange);
        };
        PatternEditor.prototype._whenCursorMoved = function () {
            var start;
            var end;
            var continuousState = this._doc.lastChangeWas(this._dragChange);
            if (this._mouseDown && this._cursor.valid && continuousState) {
                if (!this._mouseDragging) {
                    var dx = this._mouseX - this._mouseXStart;
                    var dy = this._mouseY - this._mouseYStart;
                    if (Math.sqrt(dx * dx + dy * dy) > 5) {
                        this._mouseDragging = true;
                        this._mouseHorizontal = Math.abs(dx) >= Math.abs(dy);
                    }
                }
                if (this._mouseDragging) {
                    if (this._dragChange != null) {
                        this._dragChange.undo();
                    }
                    var currentPart = Math.floor(this._mouseX / this._partWidth);
                    var sequence = new beepbox.ChangeSequence();
                    this._dragChange = sequence;
                    this._doc.setProspectiveChange(this._dragChange);
                    if (this._cursor.curNote == null) {
                        var pattern = this._ensurePatternExists(sequence);
                        if (pattern == null) {
                            this._mouseXPrev = this._mouseX;
                            this._mouseYPrev = this._mouseY;
                            return;
                        }
                        var backwards = void 0;
                        var directLength = void 0;
                        if (currentPart < this._cursor.start) {
                            backwards = true;
                            directLength = this._cursor.start - currentPart;
                        }
                        else {
                            backwards = false;
                            directLength = currentPart - this._cursor.start + 1;
                        }
                        var defaultLength = 1;
                        for (var i_1 = 0; i_1 <= this._doc.song.beatsPerBar * this._doc.song.partsPerBeat; i_1++) {
                            if (i_1 >= 5 &&
                                i_1 % this._doc.song.partsPerBeat != 0 &&
                                i_1 != this._doc.song.partsPerBeat * 3.0 / 2.0 &&
                                i_1 != this._doc.song.partsPerBeat * 4.0 / 3.0 &&
                                i_1 != this._doc.song.partsPerBeat * 5.0 / 3.0) {
                                continue;
                            }
                            var blessedLength = i_1;
                            if (blessedLength == directLength) {
                                defaultLength = blessedLength;
                                break;
                            }
                            if (blessedLength < directLength) {
                                defaultLength = blessedLength;
                            }
                            if (blessedLength > directLength) {
                                if (defaultLength < directLength - 1) {
                                    defaultLength = blessedLength;
                                }
                                break;
                            }
                        }
                        if (backwards) {
                            end = this._cursor.start;
                            start = end - defaultLength;
                        }
                        else {
                            start = this._cursor.start;
                            end = start + defaultLength;
                        }
                        if (start < 0)
                            start = 0;
                        if (end > this._doc.song.beatsPerBar * this._doc.song.partsPerBeat)
                            end = this._doc.song.beatsPerBar * this._doc.song.partsPerBeat;
                        sequence.append(new beepbox.ChangeNoteTruncate(this._doc, pattern, start, end));
                        var i = void 0;
                        for (i = 0; i < pattern.notes.length; i++) {
                            if (pattern.notes[i].start >= end)
                                break;
                        }
                        var theNote = beepbox.makeNote(this._cursor.pitch, start, end, 3, this._doc.song.getChannelIsDrum(this._doc.channel));
                        sequence.append(new beepbox.ChangeNoteAdded(this._doc, pattern, theNote, i));
                        this._copyPins(theNote);
                        this._dragTime = backwards ? start : end;
                        this._dragPitch = this._cursor.pitch;
                        this._dragVolume = theNote.pins[backwards ? 0 : 1].volume;
                        this._dragVisible = true;
                        this._pattern = pattern;
                    }
                    else if (this._mouseHorizontal) {
                        var shift = Math.round((this._mouseX - this._mouseXStart) / this._partWidth);
                        var shiftedPin = this._cursor.curNote.pins[this._cursor.nearPinIndex];
                        var shiftedTime = this._cursor.curNote.start + shiftedPin.time + shift;
                        if (shiftedTime < 0)
                            shiftedTime = 0;
                        if (shiftedTime > this._doc.song.beatsPerBar * this._doc.song.partsPerBeat)
                            shiftedTime = this._doc.song.beatsPerBar * this._doc.song.partsPerBeat;
                        if (shiftedTime <= this._cursor.curNote.start && this._cursor.nearPinIndex == this._cursor.curNote.pins.length - 1 ||
                            shiftedTime >= this._cursor.curNote.end && this._cursor.nearPinIndex == 0) {
                            sequence.append(new beepbox.ChangeNoteAdded(this._doc, this._pattern, this._cursor.curNote, this._cursor.curIndex, true));
                            this._dragVisible = false;
                        }
                        else {
                            start = Math.min(this._cursor.curNote.start, shiftedTime);
                            end = Math.max(this._cursor.curNote.end, shiftedTime);
                            this._dragTime = shiftedTime;
                            this._dragPitch = this._cursor.curNote.pitches[this._cursor.pitchIndex == -1 ? 0 : this._cursor.pitchIndex] + this._cursor.curNote.pins[this._cursor.nearPinIndex].interval;
                            this._dragVolume = this._cursor.curNote.pins[this._cursor.nearPinIndex].volume;
                            this._dragVisible = true;
                            sequence.append(new beepbox.ChangeNoteTruncate(this._doc, this._pattern, start, end, this._cursor.curNote));
                            sequence.append(new beepbox.ChangePinTime(this._doc, this._cursor.curNote, this._cursor.nearPinIndex, shiftedTime));
                            this._copyPins(this._cursor.curNote);
                        }
                    }
                    else if (this._cursor.pitchIndex == -1) {
                        var bendPart = Math.round(Math.max(this._cursor.curNote.start, Math.min(this._cursor.curNote.end, this._mouseX / this._partWidth))) - this._cursor.curNote.start;
                        var prevPin = void 0;
                        var nextPin = this._cursor.curNote.pins[0];
                        var bendVolume = 0;
                        var bendInterval = 0;
                        for (var i = 1; i < this._cursor.curNote.pins.length; i++) {
                            prevPin = nextPin;
                            nextPin = this._cursor.curNote.pins[i];
                            if (bendPart > nextPin.time)
                                continue;
                            if (bendPart < prevPin.time)
                                throw new Error();
                            var volumeRatio = (bendPart - prevPin.time) / (nextPin.time - prevPin.time);
                            bendVolume = Math.round(prevPin.volume * (1.0 - volumeRatio) + nextPin.volume * volumeRatio + ((this._mouseYStart - this._mouseY) / 20.0));
							if (bendVolume < 0)
                                bendVolume = 0;
								if (bendVolume > 3) 
								bendVolume = 3; 
							bendInterval = this._snapToPitch(prevPin.interval * (1.0 - volumeRatio) + nextPin.interval * volumeRatio + this._cursor.curNote.pitches[0], 0, beepbox.Config.maxPitch) - this._cursor.curNote.pitches[0];
							break;
                        }
                        this._dragTime = this._cursor.curNote.start + bendPart;
                        this._dragPitch = this._cursor.curNote.pitches[this._cursor.pitchIndex == -1 ? 0 : this._cursor.pitchIndex] + bendInterval;
                        this._dragVolume = bendVolume;
                        this._dragVisible = true;
                        sequence.append(new beepbox.ChangeVolumeBend(this._doc, this._cursor.curNote, bendPart, bendVolume, bendInterval));
                        this._copyPins(this._cursor.curNote);
                    }
                    else {
                        this._dragVolume = this._cursor.curNote.pins[this._cursor.nearPinIndex].volume;
                        var bendStart = void 0;
                        var bendEnd = void 0;
                        if (this._mouseX >= this._mouseXStart) {
                            bendStart = this._cursor.part;
                            bendEnd = currentPart + 1;
                        }
                        else {
                            bendStart = this._cursor.part + 1;
                            bendEnd = currentPart;
                        }
                        if (bendEnd < 0)
                            bendEnd = 0;
                        if (bendEnd > this._doc.song.beatsPerBar * this._doc.song.partsPerBeat)
                            bendEnd = this._doc.song.beatsPerBar * this._doc.song.partsPerBeat;
                        if (bendEnd > this._cursor.curNote.end) {
                            sequence.append(new beepbox.ChangeNoteTruncate(this._doc, this._pattern, this._cursor.curNote.start, bendEnd, this._cursor.curNote));
                        }
                        if (bendEnd < this._cursor.curNote.start) {
                            sequence.append(new beepbox.ChangeNoteTruncate(this._doc, this._pattern, bendEnd, this._cursor.curNote.end, this._cursor.curNote));
                        }
                        var minPitch = Number.MAX_VALUE;
                        var maxPitch = -Number.MAX_VALUE;
                        for (var _i = 0, _a = this._cursor.curNote.pitches; _i < _a.length; _i++) {
                            var pitch = _a[_i];
                            if (minPitch > pitch)
                                minPitch = pitch;
                            if (maxPitch < pitch)
                                maxPitch = pitch;
                        }
                        minPitch -= this._cursor.curNote.pitches[this._cursor.pitchIndex];
                        maxPitch -= this._cursor.curNote.pitches[this._cursor.pitchIndex];
                        var bendTo = this._snapToPitch(this._findMousePitch(this._mouseY), -minPitch, (this._doc.song.getChannelIsDrum(this._doc.channel) ? beepbox.Config.drumCount - 1 : beepbox.Config.maxPitch) - maxPitch);
                        sequence.append(new beepbox.ChangePitchBend(this._doc, this._cursor.curNote, bendStart, bendEnd, bendTo, this._cursor.pitchIndex));
                        this._copyPins(this._cursor.curNote);
                        this._dragTime = bendEnd;
                        this._dragPitch = bendTo;
                        this._dragVisible = true;
                    }
                }
                this._mouseXPrev = this._mouseX;
                this._mouseYPrev = this._mouseY;
            }
            else {
                this._updateCursorStatus();
                this._updatePreview();
            }
        };
        PatternEditor.prototype._updatePreview = function () {
            if (this._usingTouch) {
                if (!this._mouseDown || !this._cursor.valid || !this._mouseDragging || !this._dragVisible) {
                    this._svgPreview.setAttribute("visibility", "hidden");
                }
                else {
                    this._svgPreview.setAttribute("visibility", "visible");
                    var x = this._partWidth * this._dragTime;
                    var y = this._pitchToPixelHeight(this._dragPitch - this._octaveOffset);
                    var radius = this._pitchHeight / 2;
                    var width = 80;
                    var height = 60;
                    var pathString = "";
                    pathString += "M " + prettyNumber(x) + " " + prettyNumber(y - radius * (this._dragVolume / 3.0)) + " ";
                    pathString += "L " + prettyNumber(x) + " " + prettyNumber(y - radius * (this._dragVolume / 3.0) - height) + " ";
                    pathString += "M " + prettyNumber(x) + " " + prettyNumber(y + radius * (this._dragVolume / 3.0)) + " ";
                    pathString += "L " + prettyNumber(x) + " " + prettyNumber(y + radius * (this._dragVolume / 3.0) + height) + " ";
                    pathString += "M " + prettyNumber(x) + " " + prettyNumber(y - radius * (this._dragVolume / 3.0)) + " ";
                    pathString += "L " + prettyNumber(x + width) + " " + prettyNumber(y - radius * (this._dragVolume / 3.0)) + " ";
                    pathString += "M " + prettyNumber(x) + " " + prettyNumber(y + radius * (this._dragVolume / 3.0)) + " ";
                    pathString += "L " + prettyNumber(x + width) + " " + prettyNumber(y + radius * (this._dragVolume / 3.0)) + " ";
                    pathString += "M " + prettyNumber(x) + " " + prettyNumber(y - radius * (this._dragVolume / 3.0)) + " ";
                    pathString += "L " + prettyNumber(x - width) + " " + prettyNumber(y - radius * (this._dragVolume / 3.0)) + " ";
                    pathString += "M " + prettyNumber(x) + " " + prettyNumber(y + radius * (this._dragVolume / 3.0)) + " ";
                    pathString += "L " + prettyNumber(x - width) + " " + prettyNumber(y + radius * (this._dragVolume / 3.0)) + " ";
                    this._svgPreview.setAttribute("d", pathString);
                }
            }
            else {
                if (!this._mouseOver || this._mouseDown || !this._cursor.valid) {
                    this._svgPreview.setAttribute("visibility", "hidden");
                }
                else {
                    this._svgPreview.setAttribute("visibility", "visible");
                    this._drawNote(this._svgPreview, this._cursor.pitch, this._cursor.start, this._cursor.pins, this._pitchHeight / 2 + 1, true, this._octaveOffset);
                }
            }
        };
        PatternEditor.prototype._ensurePatternExists = function (sequence) {
            var pattern = this._doc.getCurrentPattern();
            if (pattern != null)
                return pattern;
            sequence.append(new beepbox.ChangeEnsurePatternExists(this._doc, this._doc.channel, this._doc.bar));
            return this._doc.getCurrentPattern();
        };
        PatternEditor.prototype._drawNote = function (svgElement, pitch, start, pins, radius, showVolume, offset) {
            var nextPin = pins[0];
            var pathString = "M " + prettyNumber(this._partWidth * (start + nextPin.time) + 1) + " " + prettyNumber(this._pitchToPixelHeight(pitch - offset) + radius * (showVolume ? nextPin.volume / 3.0 : 1.0)) + " ";
            for (var i = 1; i < pins.length; i++) {
                var prevPin = nextPin;
                nextPin = pins[i];
                var prevSide = this._partWidth * (start + prevPin.time) + (i == 1 ? 1 : 0);
                var nextSide = this._partWidth * (start + nextPin.time) - (i == pins.length - 1 ? 1 : 0);
                var prevHeight = this._pitchToPixelHeight(pitch + prevPin.interval - offset);
                var nextHeight = this._pitchToPixelHeight(pitch + nextPin.interval - offset);
                var prevVolume = showVolume ? prevPin.volume / 3.0 : 1.0;
                var nextVolume = showVolume ? nextPin.volume / 3.0 : 1.0;
                pathString += "L " + prettyNumber(prevSide) + " " + prettyNumber(prevHeight - radius * prevVolume) + " ";
                if (prevPin.interval > nextPin.interval)
                    pathString += "L " + prettyNumber(prevSide + 1) + " " + prettyNumber(prevHeight - radius * prevVolume) + " ";
                if (prevPin.interval < nextPin.interval)
                    pathString += "L " + prettyNumber(nextSide - 1) + " " + prettyNumber(nextHeight - radius * nextVolume) + " ";
                pathString += "L " + prettyNumber(nextSide) + " " + prettyNumber(nextHeight - radius * nextVolume) + " ";
            }
            for (var i = pins.length - 2; i >= 0; i--) {
                var prevPin = nextPin;
                nextPin = pins[i];
                var prevSide = this._partWidth * (start + prevPin.time) - (i == pins.length - 2 ? 1 : 0);
                var nextSide = this._partWidth * (start + nextPin.time) + (i == 0 ? 1 : 0);
                var prevHeight = this._pitchToPixelHeight(pitch + prevPin.interval - offset);
                var nextHeight = this._pitchToPixelHeight(pitch + nextPin.interval - offset);
                var prevVolume = showVolume ? prevPin.volume / 3.0 : 1.0;
                var nextVolume = showVolume ? nextPin.volume / 3.0 : 1.0;
                pathString += "L " + prettyNumber(prevSide) + " " + prettyNumber(prevHeight + radius * prevVolume) + " ";
                if (prevPin.interval < nextPin.interval)
                    pathString += "L " + prettyNumber(prevSide - 1) + " " + prettyNumber(prevHeight + radius * prevVolume) + " ";
                if (prevPin.interval > nextPin.interval)
                    pathString += "L " + prettyNumber(nextSide + 1) + " " + prettyNumber(nextHeight + radius * nextVolume) + " ";
                pathString += "L " + prettyNumber(nextSide) + " " + prettyNumber(nextHeight + radius * nextVolume) + " ";
            }
            pathString += "z";
            svgElement.setAttribute("d", pathString);
        };
        PatternEditor.prototype._pitchToPixelHeight = function (pitch) {
            return this._pitchHeight * (this._pitchCount - (pitch) - 0.5);
        };
        return PatternEditor;
    }());
    beepbox.PatternEditor = PatternEditor;
})(beepbox || (beepbox = {}));
// Track grid, pattern assignment, and multi-bar selection UI.
var beepbox;
(function (beepbox) {
    var Box = (function () {
        function Box(channel, x, y, color, showVolume) {
			this._text = beepbox.html.text("1");
			this._label = beepbox.svgElement("text", { x: 16, y: 23, "font-family": "sans-serif", "font-size": 20, "text-anchor": "middle", "font-weight": "bold", fill: "red" }, [this._text]);
			this._rect = beepbox.svgElement("rect", { width: 30, height: 27, x: 1, y: 1 });
			this._vol1 = beepbox.svgElement("rect", { width: 6, height: 3, x: 24, y: 5 });
			this._volb = beepbox.svgElement("rect", { width: 6, height: 18, x: 24, y: 5 });
			this.container = beepbox.svgElement("svg", undefined, [this._rect, this._volb, this._vol1, this._label]);
			this._renderedIndex = 1;
			this._renderedDim = true;
			this._renderedMute = true;
			this._renderedSelected = false;
			this._renderedColor = "";
			this.container.setAttribute("x", "" + (x * 32));
			this.container.setAttribute("y", "" + (y * 32));
			this._rect.setAttribute("fill", "#444444");
			this._vol1.setAttribute("fill", "#444444");
			this._volb.setAttribute("fill", "#444444");
			this._label.setAttribute("fill", color);
		}
        Box.prototype.setSquashed = function (squashed, y) {
			if (squashed) {
				this.container.setAttribute("y", "" + (y * 27));
				this._rect.setAttribute("height", "" + 25);
				this._vol1.setAttribute("height", "" + 2.7);
				this._volb.setAttribute("height", "" + 18);
				this._label.setAttribute("y", "" + 21);
			}
			else {
				this.container.setAttribute("y", "" + (y * 32));
				this._rect.setAttribute("height", "" + 30);
				this._vol1.setAttribute("height", "" + 3);
				this._volb.setAttribute("height", "" + 18);
				this._label.setAttribute("y", "" + 23);
			}
        };
        Box.prototype.setIndex = function (index, dim, selected, multiSelected, y, color, volume, colorb, selectedchannel, showVolume, mix) {
			if (mix == 2) {
				this._vol1.setAttribute("height", 18 - (volume * 2));
				this._vol1.setAttribute("y", 5 + (volume * 2));
			}
			else {
				this._vol1.setAttribute("height", 18 - (volume * 3.6));
				this._vol1.setAttribute("y", 5 + (volume * 3.6));
			}
			if (this._renderedIndex != index) {
                if (!this._renderedSelected && ((index == 0) != (this._renderedIndex == 0))) {
                    this._rect.setAttribute("fill", (index == 0) ? "#000000" : "#444444");
					this._vol1.setAttribute("fill", (index == 0) ? "#000000" : "#444444");
					this._volb.setAttribute("fill", (index == 0) ? "#000000" : "#444444");
                }
                this._renderedIndex = index;
                this._text.data = "" + index;
            }
            if (this._renderedDim != dim || this._renderedColor != color) {
                this._renderedDim = dim;
                if (selected) {
                    this._label.setAttribute("fill", "#000000");
                }
                else {
                    this._label.setAttribute("fill", color);
                }
            }
            if (this._renderedSelected != selected || this._renderedColor != color) {
                this._renderedSelected = selected;
                if (selected) {
                    this._rect.setAttribute("fill", color);
					this._vol1.setAttribute("fill", color);
					this._volb.setAttribute("fill", color);
                    this._label.setAttribute("fill", "#000000");
                }
                else {
					this._rect.setAttribute("fill", (this._renderedIndex == 0) ? "#000000" : "#444444");
					this._vol1.setAttribute("fill", (this._renderedIndex == 0) ? "#000000" : color);
					this._volb.setAttribute("fill", (this._renderedIndex == 0) ? "#000000" : colorb);
					this._label.setAttribute("fill", color);
                }
            }
			if(showVolume){
				this._label.setAttribute("x", 12, "y", 23, "font-family", "sans-serif", "font-size", 18, "text-anchor", "middle", "font-weight", "bold", "fill", "red");
				this._vol1.style.visibility = "visible";
				this._volb.style.visibility = "visible";
			}
			else {
				this._label.setAttribute("x", 16, "y", 23, "font-family", "sans-serif", "font-size", 20, "text-anchor", "middle", "font-weight", "bold", "fill", "red");
				this._vol1.style.visibility = "hidden";
				this._volb.style.visibility = "hidden";
			}
            this._renderedColor = color;
        };
        return Box;
    }());
    var TrackEditor = (function () {
        function TrackEditor(_doc, _songEditor) {
            var _this = this;
            this._doc = _doc;
            this._songEditor = _songEditor;
            this._barWidth = 32;
            this._svg = beepbox.svgElement("svg", { style: "background-color: #000000; position: absolute;", height: 128 });
            this._select = beepbox.html.select({ className: "trackSelectBox", style: "width: 32px; height: 32px; background: none; border: none; appearance: none; color: transparent; position: absolute;" });
            this.container = beepbox.html.div({ style: "height: 128px; position: relative; overflow:hidden;" }, [this._svg, this._select]);
            this._boxContainer = beepbox.svgElement("g");
            this._playhead = beepbox.svgElement("rect", { fill: "white", x: 0, y: 0, width: 4, height: 128 });
            this._boxHighlight = beepbox.svgElement("rect", { fill: "none", stroke: "white", "stroke-width": 2, "pointer-events": "none", x: 1, y: 1, width: 30, height: 30 });
            this._selectionFill = beepbox.svgElement("rect", { fill: "#808080", opacity: 0.28, stroke: "none", "pointer-events": "none", visibility: "hidden", x: 1, y: 1, width: 30, height: 30 });
            this._selectionHighlight = beepbox.svgElement("rect", { fill: "none", stroke: "white", "stroke-width": 2, "stroke-dasharray": "4 2", "pointer-events": "none", visibility: "hidden", x: 1, y: 1, width: 30, height: 30 });
            this._upHighlight = beepbox.svgElement("path", { fill: "black", stroke: "black", "stroke-width": 1, "pointer-events": "none" });
            this._downHighlight = beepbox.svgElement("path", { fill: "black", stroke: "black", "stroke-width": 1, "pointer-events": "none" });
            this._grid = [];
            this._mouseX = 0;
            this._mouseY = 0;
            this._pattern = null;
            this._mouseOver = false;
            this._digits = "";
            this._editorHeight = 128;
            this._channelHeight = 32;
            this._mouseDown = false;
            this._dragSelecting = false;
            this._dragBar = 0;
            this._dragChannel = 0;
            this._pressedOnCurrentBox = false;
            this._selectionBarStart = 0;
            this._selectionBarEnd = 0;
            this._selectionChannelStart = 0;
            this._selectionChannelEnd = 0;
            this._renderedChannelCount = 0;
            this._renderedBarCount = 0;
            this._renderedPatternCount = 0;
            this._renderedPlayhead = -1;
            this._renderedSquashed = false;
            this._changePattern = null;
            this._whenSelectChanged = function () {
                _this._setPattern(_this._select.selectedIndex);
            };
            this._animatePlayhead = function (timestamp) {
                var playhead = (_this._barWidth * _this._doc.synth.playhead - 2);
                if (_this._renderedPlayhead != playhead) {
                    _this._renderedPlayhead = playhead;
                    _this._playhead.setAttribute("x", "" + playhead);
                }
                window.requestAnimationFrame(_this._animatePlayhead);
            };
            this._whenMouseOver = function (event) {
                if (_this._mouseOver)
                    return;
                _this._mouseOver = true;
            };
            this._whenMouseOut = function (event) {
                if (!_this._mouseOver)
                    return;
                _this._mouseOver = false;
            };
            this._whenMousePressed = function (event) {
                event.preventDefault();
                var boundingRect = _this._svg.getBoundingClientRect();
                _this._mouseX = (event.clientX || event.pageX) - boundingRect.left;
                _this._mouseY = (event.clientY || event.pageY) - boundingRect.top;
                _this._mouseDown = true;
                _this._dragSelecting = false;
                _this._dragChannel = _this._findChannel();
                _this._dragBar = _this._findBar();
                _this._pressedOnCurrentBox = (_this._doc.channel == _this._dragChannel && _this._doc.bar == _this._dragBar);
                _this._selectionBarStart = _this._dragBar;
                _this._selectionBarEnd = _this._dragBar;
                _this._selectionChannelStart = _this._dragChannel;
                _this._selectionChannelEnd = _this._dragChannel;
                if (_this._doc.channel != _this._dragChannel || _this._doc.bar != _this._dragBar) {
                    _this._doc.channel = _this._dragChannel;
                    _this._doc.bar = _this._dragBar;
                    _this._doc.barScrollPos = Math.min(_this._doc.bar, Math.max(_this._doc.bar - (_this._doc.trackVisibleBars - 1), _this._doc.barScrollPos));
                }
                if (!_this._doc.synth.playing) {
                    _this._doc.synth.snapToBar(_this._dragBar);
                }
                _this._doc.notifier.changed();
            };
            this._whenMouseMoved = function (event) {
                var boundingRect = _this._svg.getBoundingClientRect();
                _this._mouseX = (event.clientX || event.pageX) - boundingRect.left;
                _this._mouseY = (event.clientY || event.pageY) - boundingRect.top;
                if (_this._mouseDown) {
                    var channel = _this._findChannel();
                    var bar = _this._findBar();
                    if (channel != _this._dragChannel || bar != _this._dragBar) {
                        _this._dragSelecting = true;
                        _this._setTrackSelection(_this._dragBar, bar, _this._dragChannel, channel);
                    }
                }
                _this._updatePreview();
            };
            this._whenMouseReleased = function (event) {
                if (!_this._mouseDown)
                    return;
                _this._mouseDown = false;
                if (_this._dragSelecting) {
                    _this._doc.channel = _this._dragChannel;
                    _this._doc.bar = _this._dragBar;
                    _this._doc.barScrollPos = Math.min(_this._doc.bar, Math.max(_this._doc.bar - (_this._doc.trackVisibleBars - 1), _this._doc.barScrollPos));
                    if (!_this._doc.synth.playing) {
                        _this._doc.synth.snapToBar(_this._dragBar);
                    }
                    _this._doc.notifier.changed();
                    return;
                }
                var channel = _this._dragChannel;
                var bar = _this._dragBar;
                _this.clearSelection();
                if (_this._pressedOnCurrentBox) {
                    var up = (_this._mouseY % _this._channelHeight) < _this._channelHeight / 2;
                    var patternCount = _this._doc.song.patternsPerChannel;
                    _this._setPattern((_this._doc.song.channels[channel].bars[bar] + (up ? 1 : patternCount)) % (patternCount + 1));
                }
                else {
                    _this._setChannelBar(channel, bar);
                }
            };
            this._svg.appendChild(this._boxContainer);
            this._svg.appendChild(this._boxHighlight);
            this._svg.appendChild(this._selectionFill);
            this._svg.appendChild(this._selectionHighlight);
            this._svg.appendChild(this._upHighlight);
            this._svg.appendChild(this._downHighlight);
            this._svg.appendChild(this._playhead);
            window.requestAnimationFrame(this._animatePlayhead);
            this._svg.addEventListener("mousedown", this._whenMousePressed);
            document.addEventListener("mousemove", this._whenMouseMoved);
            document.addEventListener("mouseup", this._whenMouseReleased);
            this._svg.addEventListener("mouseover", this._whenMouseOver);
            this._svg.addEventListener("mouseout", this._whenMouseOut);
            this._select.addEventListener("change", this._whenSelectChanged);
        }
        TrackEditor.prototype._findBar = function () {
            return Math.floor(Math.min(this._doc.song.barCount - 1, Math.max(0, this._mouseX / this._barWidth)));
        };
        TrackEditor.prototype._findChannel = function () {
            return Math.floor(Math.min(this._doc.song.getChannelCount() - 1, Math.max(0, this._mouseY / this._channelHeight)));
        };
        TrackEditor.prototype._setTrackSelection = function (barStart, barEnd, channelStart, channelEnd) {
            this._selectionBarStart = barStart;
            this._selectionBarEnd = barEnd;
            this._selectionChannelStart = channelStart;
            this._selectionChannelEnd = channelEnd;
            this._doc.notifier.changed();
        };
        TrackEditor.prototype.getSelection = function () {
            return {
                barStart: Math.min(this._selectionBarStart, this._selectionBarEnd),
                barEnd: Math.max(this._selectionBarStart, this._selectionBarEnd),
                channelStart: Math.min(this._selectionChannelStart, this._selectionChannelEnd),
                channelEnd: Math.max(this._selectionChannelStart, this._selectionChannelEnd),
            };
        };
        TrackEditor.prototype.hasSelection = function () {
            var selection = this.getSelection();
            return selection.barStart != selection.barEnd || selection.channelStart != selection.channelEnd;
        };
        TrackEditor.prototype.isSelected = function (bar, channel) {
            return bar == this._doc.bar && channel == this._doc.channel;
        };
        TrackEditor.prototype.isMultiSelected = function (bar, channel) {
            if (!this.hasSelection())
                return false;
            var selection = this.getSelection();
            return bar >= selection.barStart && bar <= selection.barEnd && channel >= selection.channelStart && channel <= selection.channelEnd;
        };
        TrackEditor.prototype.clearSelection = function () {
            if (!this.hasSelection())
                return;
            this._selectionBarStart = this._doc.bar;
            this._selectionBarEnd = this._doc.bar;
            this._selectionChannelStart = this._doc.channel;
            this._selectionChannelEnd = this._doc.channel;
            this._doc.notifier.changed();
        };
        TrackEditor.prototype._setChannelBar = function (channel, bar) {
            this._selectionBarStart = bar;
            this._selectionBarEnd = bar;
            this._selectionChannelStart = channel;
            this._selectionChannelEnd = channel;
            new beepbox.ChangeChannelBar(this._doc, channel, bar);
            this._digits = "";
            this._doc.forgetLastChange();
        };
        TrackEditor.prototype._setPattern = function (pattern) {
            if (this.hasSelection()) {
                var selection = this.getSelection();
                var group = new beepbox.ChangeGroup();
                for (var channel = selection.channelStart; channel <= selection.channelEnd; channel++) {
                    for (var bar = selection.barStart; bar <= selection.barEnd; bar++) {
                        group.append(new beepbox.ChangeBarPattern(this._doc, channel, bar, pattern));
                    }
                }
                this._doc.record(group);
                this._changePattern = null;
                return;
            }
            var currentValue = this._doc.song.channels[this._doc.channel].bars[this._doc.bar];
            var canReplaceLastChange = this._doc.lastChangeWas(this._changePattern);
            var oldValue = canReplaceLastChange ? this._changePattern.oldValue : currentValue;
            if (pattern != currentValue) {
                this._changePattern = new beepbox.ChangePattern(this._doc, oldValue, pattern);
                this._doc.record(this._changePattern, canReplaceLastChange);
            }
        };
        TrackEditor.prototype.onKeyPressed = function (event) {
            switch (event.keyCode) {
                case 38:
                    this._setChannelBar((this._doc.channel - 1 + this._doc.song.getChannelCount()) % this._doc.song.getChannelCount(), this._doc.bar);
                    event.preventDefault();
                    break;
                case 40:
                    this._setChannelBar((this._doc.channel + 1) % this._doc.song.getChannelCount(), this._doc.bar);
                    event.preventDefault();
                    break;
                case 37:
                    this._setChannelBar(this._doc.channel, (this._doc.bar + this._doc.song.barCount - 1) % this._doc.song.barCount);
                    event.preventDefault();
                    break;
                case 39:
                    this._setChannelBar(this._doc.channel, (this._doc.bar + 1) % this._doc.song.barCount);
                    event.preventDefault();
                    break;
                case 48:
                    this._nextDigit("0");
                    event.preventDefault();
                    break;
                case 49:
                    this._nextDigit("1");
                    event.preventDefault();
                    break;
                case 50:
                    this._nextDigit("2");
                    event.preventDefault();
                    break;
                case 51:
                    this._nextDigit("3");
                    event.preventDefault();
                    break;
                case 52:
                    this._nextDigit("4");
                    event.preventDefault();
                    break;
                case 53:
                    this._nextDigit("5");
                    event.preventDefault();
                    break;
                case 54:
                    this._nextDigit("6");
                    event.preventDefault();
                    break;
                case 55:
                    this._nextDigit("7");
                    event.preventDefault();
                    break;
                case 56:
                    this._nextDigit("8");
                    event.preventDefault();
                    break;
                case 57:
                    this._nextDigit("9");
                    event.preventDefault();
                    break;
                default:
                    this._digits = "";
                    break;
            }
        };
        TrackEditor.prototype._nextDigit = function (digit) {
            if (this.hasSelection()) {
                var selectedPattern = this._doc.song.channels[this._doc.channel].bars[this._doc.bar];
                if (this._digits.length > 0 && this._digits != String(selectedPattern)) {
                    this._digits = "";
                }
            }
            this._digits += digit;
            var parsed = parseInt(this._digits);
            if (parsed <= this._doc.song.patternsPerChannel) {
                this._setPattern(parsed);
                return;
            }
            this._digits = digit;
            parsed = parseInt(this._digits);
            if (parsed <= this._doc.song.patternsPerChannel) {
                this._setPattern(parsed);
                return;
            }
            this._digits = "";
        };
        TrackEditor.prototype._updatePreview = function () {
            var channel = this._findChannel();
            var bar = this._findBar();
            var wideScreen = window.innerWidth > 700;
            if (!wideScreen) {
                bar = this._doc.bar;
                channel = this._doc.channel;
            }
            var selected = this.isSelected(bar, channel);
            if (this._mouseOver && !selected) {
                this._boxHighlight.setAttribute("x", "" + (1 + this._barWidth * bar));
                this._boxHighlight.setAttribute("y", "" + (1 + (this._channelHeight * channel)));
                this._boxHighlight.setAttribute("height", "" + (this._channelHeight - 2));
                this._boxHighlight.style.visibility = "visible";
            }
            else {
                this._boxHighlight.style.visibility = "hidden";
            }
            if ((this._mouseOver || !wideScreen) && selected) {
                var up = (this._mouseY % this._channelHeight) < this._channelHeight / 2;
                var center = this._barWidth * (bar + 0.8);
                var middle = this._channelHeight * (channel + 0.5);
                var base = this._channelHeight * 0.1;
                var tip = this._channelHeight * 0.4;
                var width = this._channelHeight * 0.175;
                this._upHighlight.setAttribute("fill", up && wideScreen ? "#fff" : "#000");
                this._downHighlight.setAttribute("fill", !up && wideScreen ? "#fff" : "#000");
                this._upHighlight.setAttribute("d", "M " + center + " " + (middle - tip) + " L " + (center + width) + " " + (middle - base) + " L " + (center - width) + " " + (middle - base) + " z");
                this._downHighlight.setAttribute("d", "M " + center + " " + (middle + tip) + " L " + (center + width) + " " + (middle + base) + " L " + (center - width) + " " + (middle + base) + " z");
                this._upHighlight.style.visibility = "visible";
                this._downHighlight.style.visibility = "visible";
            }
            else {
                this._upHighlight.style.visibility = "hidden";
                this._downHighlight.style.visibility = "hidden";
            }
            if (this.hasSelection()) {
                var selection = this.getSelection();
                this._selectionFill.setAttribute("x", "" + (1 + this._barWidth * selection.barStart));
                this._selectionFill.setAttribute("y", "" + (1 + this._channelHeight * selection.channelStart));
                this._selectionFill.setAttribute("width", "" + (this._barWidth * (selection.barEnd - selection.barStart + 1) - 2));
                this._selectionFill.setAttribute("height", "" + (this._channelHeight * (selection.channelEnd - selection.channelStart + 1) - 2));
                this._selectionFill.style.visibility = "visible";
                this._selectionHighlight.setAttribute("x", "" + (1 + this._barWidth * selection.barStart));
                this._selectionHighlight.setAttribute("y", "" + (1 + this._channelHeight * selection.channelStart));
                this._selectionHighlight.setAttribute("width", "" + (this._barWidth * (selection.barEnd - selection.barStart + 1) - 2));
                this._selectionHighlight.setAttribute("height", "" + (this._channelHeight * (selection.channelEnd - selection.channelStart + 1) - 2));
                this._selectionHighlight.style.visibility = "visible";
            }
            else {
                this._selectionFill.style.visibility = "hidden";
                this._selectionHighlight.style.visibility = "hidden";
            }
            this._select.style.left = (this._barWidth * this._doc.bar) + "px";
            this._select.style.top = (this._channelHeight * this._doc.channel) + "px";
            this._select.style.height = this._channelHeight + "px";
            var patternCount = this._doc.song.patternsPerChannel;
            for (var i = this._renderedPatternCount; i < patternCount; i++) {
                this._select.appendChild(beepbox.html.option(i, i, false, false));
            }
            for (var i = patternCount; i < this._renderedPatternCount; i++) {
                this._select.removeChild(this._select.lastChild);
            }
            this._renderedPatternCount = patternCount;
            var selectedPattern = this._doc.song.channels[this._doc.channel].bars[this._doc.bar];
            if (this._select.selectedIndex != selectedPattern)
                this._select.selectedIndex = selectedPattern;
        };
        TrackEditor.prototype.render = function () {
            this._pattern = this._doc.getCurrentPattern();
            var wideScreen = window.innerWidth > 700;
            var squashed = !wideScreen || this._doc.song.getChannelCount() > 5 || (this._doc.song.barCount > this._doc.trackVisibleBars && this._doc.song.getChannelCount() > 3);
            this._channelHeight = squashed ? 27 : 32;
            if (this._renderedChannelCount != this._doc.song.getChannelCount()) {
                for (var y = this._renderedChannelCount; y < this._doc.song.getChannelCount(); y++) {
                    this._grid[y] = [];
                    for (var x = 0; x < this._renderedBarCount; x++) {
                        var box = new Box(y, x, y, this._doc.song.getChannelColorDim(y), this._doc.showChannelVolume);
                        box.setSquashed(squashed, y);
                        this._boxContainer.appendChild(box.container);
                        this._grid[y][x] = box;
                    }
                }
                for (var y = this._doc.song.getChannelCount(); y < this._renderedChannelCount; y++) {
                    for (var x = 0; x < this._renderedBarCount; x++) {
                        this._boxContainer.removeChild(this._grid[y][x].container);
                    }
                }
                this._grid.length = this._doc.song.getChannelCount();
            }
            if (this._renderedBarCount != this._doc.song.barCount) {
                for (var y = 0; y < this._doc.song.getChannelCount(); y++) {
                    for (var x = this._renderedBarCount; x < this._doc.song.barCount; x++) {
                        var box = new Box(y, x, y, this._doc.song.getChannelColorDim(y), this._doc.showChannelVolume);
                        box.setSquashed(squashed, y);
                        this._boxContainer.appendChild(box.container);
                        this._grid[y][x] = box;
                    }
                    for (var x = this._doc.song.barCount; x < this._renderedBarCount; x++) {
                        this._boxContainer.removeChild(this._grid[y][x].container);
                    }
                    this._grid[y].length = this._doc.song.barCount;
                }
                this._renderedBarCount = this._doc.song.barCount;
                var editorWidth = 32 * this._doc.song.barCount;
                this.container.style.width = editorWidth + "px";
                this._svg.setAttribute("width", editorWidth + "");
            }
            if (this._renderedSquashed != squashed) {
                for (var y = 0; y < this._doc.song.getChannelCount(); y++) {
                    for (var x = 0; x < this._renderedBarCount; x++) {
                        this._grid[y][x].setSquashed(squashed, y);
                    }
                }
            }
            if (this._renderedSquashed != squashed || this._renderedChannelCount != this._doc.song.getChannelCount()) {
                this._renderedSquashed = squashed;
                this._renderedChannelCount = this._doc.song.getChannelCount();
                this._editorHeight = this._doc.song.getChannelCount() * this._channelHeight;
                this._svg.setAttribute("height", "" + this._editorHeight);
                this._playhead.setAttribute("height", "" + this._editorHeight);
                this.container.style.height = this._editorHeight + "px";
            }
            for (var j = 0; j < this._doc.song.getChannelCount(); j++) {
                for (var i = 0; i < this._renderedBarCount; i++) {
                    var pattern = this._doc.song.getPattern(j, i);
					var patternmute = this._doc.song.getPatternInstrumentMute(j, i);
					var patternvolume = this._doc.song.getPatternInstrumentVolume(j, i);
                    var selected = this.isSelected(i, j);
                    var multiSelected = this.isMultiSelected(i, j);
					var selectedchannel = (j == this._doc.channel);
                    var dim = (pattern == null || pattern.notes.length == 0);
					var mute = (patternmute == 1);
					var volume = patternvolume;
                    var box = this._grid[j][i];
                    if (i < this._doc.song.barCount) {
                        box.setIndex(this._doc.song.channels[j].bars[i], dim, selected, multiSelected, j, dim && !selected && !mute ? this._doc.song.getChannelColorDim(j) : mute && !selected ? "#161616" : this._doc.song.getChannelColorBright(j), volume, dim && !selected && !mute ? this._doc.song.getChannelColorDim(j) : mute && !selected ? "#9b9b9b" : this._doc.song.getChannelColorDim(j), selectedchannel, this._doc.showChannelVolume, this._doc.song.mix);
                        box.container.style.visibility = "visible";
                    }
                    else {
                        box.container.style.visibility = "hidden";
                    }
                }
            }
            this._updatePreview();
        };
        return TrackEditor;
    }());
    beepbox.TrackEditor = TrackEditor;
})(beepbox || (beepbox = {}));
// Loop editor widget.
var beepbox;
(function (beepbox) {
    var LoopEditor = (function () {
        function LoopEditor(_doc) {
            var _this = this;
            this._doc = _doc;
            this._barWidth = 32;
            this._editorHeight = 20;
            this._startMode = 0;
            this._endMode = 1;
            this._bothMode = 2;
            this._loop = beepbox.svgElement("path", { fill: "none", stroke: sliderOneColorPallet[_this._doc.song.theme], "stroke-width": 4 });
            this._highlight = beepbox.svgElement("path", { fill: "white", "pointer-events": "none" });
            this._svg = beepbox.svgElement("svg", { style: "background-color: #000000; touch-action: pan-y; position: absolute;", height: this._editorHeight }, [
                this._loop,
                this._highlight,
            ]);
            this.container = beepbox.html.div({ style: "height: 20px; position: relative; margin: 5px 0;" }, [this._svg]);
            this._change = null;
            this._cursor = { startBar: -1, mode: -1 };
            this._mouseX = 0;
            this._mouseY = 0;
            this._clientStartX = 0;
            this._clientStartY = 0;
            this._startedScrolling = false;
            this._draggingHorizontally = false;
            this._mouseDown = false;
            this._mouseOver = false;
            this._renderedLoopStart = -1;
            this._renderedLoopStop = -1;
            this._renderedBarCount = 0;
            this._whenMouseOver = function (event) {
                if (_this._mouseOver)
                    return;
                _this._mouseOver = true;
                _this._updatePreview();
            };
            this._whenMouseOut = function (event) {
                if (!_this._mouseOver)
                    return;
                _this._mouseOver = false;
                _this._updatePreview();
            };
            this._whenMousePressed = function (event) {
                event.preventDefault();
                _this._mouseDown = true;
                var boundingRect = _this._svg.getBoundingClientRect();
                _this._mouseX = (event.clientX || event.pageX) - boundingRect.left;
                _this._mouseY = (event.clientY || event.pageY) - boundingRect.top;
                _this._updateCursorStatus();
                _this._updatePreview();
                _this._whenMouseMoved(event);
            };
            this._whenTouchPressed = function (event) {
                _this._mouseDown = true;
                var boundingRect = _this._svg.getBoundingClientRect();
                _this._mouseX = event.touches[0].clientX - boundingRect.left;
                _this._mouseY = event.touches[0].clientY - boundingRect.top;
                _this._updateCursorStatus();
                _this._updatePreview();
                _this._clientStartX = event.touches[0].clientX;
                _this._clientStartY = event.touches[0].clientY;
                _this._draggingHorizontally = false;
                _this._startedScrolling = false;
            };
            this._whenMouseMoved = function (event) {
                var boundingRect = _this._svg.getBoundingClientRect();
                _this._mouseX = (event.clientX || event.pageX) - boundingRect.left;
                _this._mouseY = (event.clientY || event.pageY) - boundingRect.top;
                _this._whenCursorMoved();
            };
            this._whenTouchMoved = function (event) {
                if (!_this._mouseDown)
                    return;
                var boundingRect = _this._svg.getBoundingClientRect();
                _this._mouseX = event.touches[0].clientX - boundingRect.left;
                _this._mouseY = event.touches[0].clientY - boundingRect.top;
                if (!_this._draggingHorizontally && !_this._startedScrolling) {
                    if (Math.abs(event.touches[0].clientY - _this._clientStartY) > 10) {
                        _this._startedScrolling = true;
                    }
                    else if (Math.abs(event.touches[0].clientX - _this._clientStartX) > 10) {
                        _this._draggingHorizontally = true;
                    }
                }
                if (_this._draggingHorizontally) {
                    _this._whenCursorMoved();
                    event.preventDefault();
                }
            };
            this._whenTouchReleased = function (event) {
                event.preventDefault();
                if (!_this._startedScrolling) {
                    _this._whenCursorMoved();
                    _this._mouseOver = false;
                    _this._whenCursorReleased(event);
                    _this._updatePreview();
                }
            };
            this._whenCursorReleased = function (event) {
                if (_this._change != null)
                    _this._doc.record(_this._change);
                _this._change = null;
                _this._mouseDown = false;
                _this._updateCursorStatus();
                _this._render();
            };
            this._documentChanged = function () {
                _this._render();
            };
            this._updateCursorStatus();
            this._render();
            this._doc.notifier.watch(this._documentChanged);
            this.container.addEventListener("mousedown", this._whenMousePressed);
            document.addEventListener("mousemove", this._whenMouseMoved);
            document.addEventListener("mouseup", this._whenCursorReleased);
            this.container.addEventListener("mouseover", this._whenMouseOver);
            this.container.addEventListener("mouseout", this._whenMouseOut);
            this.container.addEventListener("touchstart", this._whenTouchPressed);
            this.container.addEventListener("touchmove", this._whenTouchMoved);
            this.container.addEventListener("touchend", this._whenTouchReleased);
            this.container.addEventListener("touchcancel", this._whenTouchReleased);
        }
        LoopEditor.prototype._updateCursorStatus = function () {
            var bar = this._mouseX / this._barWidth;
            this._cursor.startBar = bar;
            if (bar > this._doc.song.loopStart - 0.25 && bar < this._doc.song.loopStart + this._doc.song.loopLength + 0.25) {
                if (bar - this._doc.song.loopStart < this._doc.song.loopLength * 0.5) {
                    this._cursor.mode = this._startMode;
                }
                else {
                    this._cursor.mode = this._endMode;
                }
            }
            else {
                this._cursor.mode = this._bothMode;
            }
        };
        LoopEditor.prototype._findEndPoints = function (middle) {
            var start = Math.round(middle - this._doc.song.loopLength / 2);
            var end = start + this._doc.song.loopLength;
            if (start < 0) {
                end -= start;
                start = 0;
            }
            if (end > this._doc.song.barCount) {
                start -= end - this._doc.song.barCount;
                end = this._doc.song.barCount;
            }
            return { start: start, length: end - start };
        };
        LoopEditor.prototype._whenCursorMoved = function () {
            if (this._mouseDown) {
                var oldStart = this._doc.song.loopStart;
                var oldEnd = this._doc.song.loopStart + this._doc.song.loopLength;
                if (this._change != null && this._doc.lastChangeWas(this._change)) {
                    oldStart = this._change.oldStart;
                    oldEnd = oldStart + this._change.oldLength;
                }
                var bar = this._mouseX / this._barWidth;
                var start = void 0;
                var end = void 0;
                var temp = void 0;
                if (this._cursor.mode == this._startMode) {
                    start = oldStart + Math.round(bar - this._cursor.startBar);
                    end = oldEnd;
                    if (start == end) {
                        start = end - 1;
                    }
                    else if (start > end) {
                        temp = start;
                        start = end;
                        end = temp;
                    }
                    if (start < 0)
                        start = 0;
                    if (end >= this._doc.song.barCount)
                        end = this._doc.song.barCount;
                    this._change = new beepbox.ChangeLoop(this._doc, oldStart, oldEnd - oldStart, start, end - start);
                }
                else if (this._cursor.mode == this._endMode) {
                    start = oldStart;
                    end = oldEnd + Math.round(bar - this._cursor.startBar);
                    if (end == start) {
                        end = start + 1;
                    }
                    else if (end < start) {
                        temp = start;
                        start = end;
                        end = temp;
                    }
                    if (start < 0)
                        start = 0;
                    if (end >= this._doc.song.barCount)
                        end = this._doc.song.barCount;
                    this._change = new beepbox.ChangeLoop(this._doc, oldStart, oldEnd - oldStart, start, end - start);
                }
                else if (this._cursor.mode == this._bothMode) {
                    var endPoints = this._findEndPoints(bar);
                    this._change = new beepbox.ChangeLoop(this._doc, oldStart, oldEnd - oldStart, endPoints.start, endPoints.length);
                }
                this._doc.setProspectiveChange(this._change);
            }
            else {
                this._updateCursorStatus();
                this._updatePreview();
            }
        };
        LoopEditor.prototype._updatePreview = function () {
            var showHighlight = this._mouseOver && !this._mouseDown;
            this._highlight.style.visibility = showHighlight ? "visible" : "hidden";
            if (showHighlight) {
                var radius = this._editorHeight / 2;
                var highlightStart = (this._doc.song.loopStart) * this._barWidth;
                var highlightStop = (this._doc.song.loopStart + this._doc.song.loopLength) * this._barWidth;
                if (this._cursor.mode == this._startMode) {
                    highlightStop = (this._doc.song.loopStart) * this._barWidth + radius * 2;
                }
                else if (this._cursor.mode == this._endMode) {
                    highlightStart = (this._doc.song.loopStart + this._doc.song.loopLength) * this._barWidth - radius * 2;
                }
                else {
                    var endPoints = this._findEndPoints(this._cursor.startBar);
                    highlightStart = (endPoints.start) * this._barWidth;
                    highlightStop = (endPoints.start + endPoints.length) * this._barWidth;
                }
                this._highlight.setAttribute("d", "M " + (highlightStart + radius) + " " + 4 + " " +
                    ("L " + (highlightStop - radius) + " " + 4 + " ") +
                    ("A " + (radius - 4) + " " + (radius - 4) + " " + 0 + " " + 0 + " " + 1 + " " + (highlightStop - radius) + " " + (this._editorHeight - 4) + " ") +
                    ("L " + (highlightStart + radius) + " " + (this._editorHeight - 4) + " ") +
                    ("A " + (radius - 4) + " " + (radius - 4) + " " + 0 + " " + 0 + " " + 1 + " " + (highlightStart + radius) + " " + 4 + " ") +
                    "z");
            }
        };
        LoopEditor.prototype._render = function () {
            var radius = this._editorHeight / 2;
            var loopStart = (this._doc.song.loopStart) * this._barWidth;
            var loopStop = (this._doc.song.loopStart + this._doc.song.loopLength) * this._barWidth;
            if (this._renderedBarCount != this._doc.song.barCount) {
                this._renderedBarCount = this._doc.song.barCount;
                var editorWidth = 32 * this._doc.song.barCount;
                this.container.style.width = editorWidth + "px";
                this._svg.setAttribute("width", editorWidth + "");
            }
            if (this._renderedLoopStart != loopStart || this._renderedLoopStop != loopStop) {
                this._renderedLoopStart = loopStart;
                this._renderedLoopStop = loopStop;
                this._loop.setAttribute("d", "M " + (loopStart + radius) + " " + 2 + " " +
                    ("L " + (loopStop - radius) + " " + 2 + " ") +
                    ("A " + (radius - 2) + " " + (radius - 2) + " " + 0 + " " + 0 + " " + 1 + " " + (loopStop - radius) + " " + (this._editorHeight - 2) + " ") +
                    ("L " + (loopStart + radius) + " " + (this._editorHeight - 2) + " ") +
                    ("A " + (radius - 2) + " " + (radius - 2) + " " + 0 + " " + 0 + " " + 1 + " " + (loopStart + radius) + " " + 2 + " ") +
                    "z");
            }
            this._updatePreview();
        };
        return LoopEditor;
    }());
    beepbox.LoopEditor = LoopEditor;
})(beepbox || (beepbox = {}));
// Horizontal bar scrollbar for wide songs.
var beepbox;
(function (beepbox) {
    var BarScrollBar = (function () {
        function BarScrollBar(_doc, _trackContainer) {
            var _this = this;
            this._doc = _doc;
            this._trackContainer = _trackContainer;
            this._editorWidth = 512;
            this._editorHeight = 20;
            this._notches = beepbox.svgElement("svg", { "pointer-events": "none" });
            this._handle = beepbox.svgElement("rect", { fill: "#444444", x: 0, y: 2, width: 10, height: this._editorHeight - 4 });
            this._handleHighlight = beepbox.svgElement("rect", { fill: "none", stroke: "white", "stroke-width": 2, "pointer-events": "none", x: 0, y: 1, width: 10, height: this._editorHeight - 2 });
            this._leftHighlight = beepbox.svgElement("path", { fill: "white", "pointer-events": "none" });
            this._rightHighlight = beepbox.svgElement("path", { fill: "white", "pointer-events": "none" });
            this._svg = beepbox.svgElement("svg", { style: "background-color: #000000; touch-action: pan-y; position: absolute;", width: this._editorWidth, height: this._editorHeight }, [
                this._notches,
                this._handle,
                this._handleHighlight,
                this._leftHighlight,
                this._rightHighlight,
            ]);
            this.container = beepbox.html.div({ className: "barScrollBar", style: "width: 512px; height: 20px; overflow: hidden; position: relative;" }, [this._svg]);
            this._mouseX = 0;
            this._mouseY = 0;
            this._mouseDown = false;
            this._mouseOver = false;
            this._dragging = false;
            this._renderedNotchCount = -1;
            this._renderedBarPos = -1;
            this._onScroll = function (event) {
                _this._doc.barScrollPos = (_this._trackContainer.scrollLeft / 32);
            };
            this._whenMouseOver = function (event) {
                if (_this._mouseOver)
                    return;
                _this._mouseOver = true;
                _this._updatePreview();
            };
            this._whenMouseOut = function (event) {
                if (!_this._mouseOver)
                    return;
                _this._mouseOver = false;
                _this._updatePreview();
            };
            this._whenMousePressed = function (event) {
                event.preventDefault();
                _this._mouseDown = true;
                var boundingRect = _this._svg.getBoundingClientRect();
                _this._mouseX = (event.clientX || event.pageX) - boundingRect.left;
                _this._mouseY = (event.clientY || event.pageY) - boundingRect.top;
                _this._updatePreview();
                if (_this._mouseX >= _this._doc.barScrollPos * _this._barWidth && _this._mouseX <= (_this._doc.barScrollPos + _this._doc.trackVisibleBars) * _this._barWidth) {
                    _this._dragging = true;
                    _this._dragStart = _this._mouseX;
                }
            };
            this._whenTouchPressed = function (event) {
                event.preventDefault();
                _this._mouseDown = true;
                var boundingRect = _this._svg.getBoundingClientRect();
                _this._mouseX = event.touches[0].clientX - boundingRect.left;
                _this._mouseY = event.touches[0].clientY - boundingRect.top;
                _this._updatePreview();
                if (_this._mouseX >= _this._doc.barScrollPos * _this._barWidth && _this._mouseX <= (_this._doc.barScrollPos + _this._doc.trackVisibleBars) * _this._barWidth) {
                    _this._dragging = true;
                    _this._dragStart = _this._mouseX;
                }
            };
            this._whenMouseMoved = function (event) {
                var boundingRect = _this._svg.getBoundingClientRect();
                _this._mouseX = (event.clientX || event.pageX) - boundingRect.left;
                _this._mouseY = (event.clientY || event.pageY) - boundingRect.top;
                _this._whenCursorMoved();
            };
            this._whenTouchMoved = function (event) {
                if (!_this._mouseDown)
                    return;
                event.preventDefault();
                var boundingRect = _this._svg.getBoundingClientRect();
                _this._mouseX = event.touches[0].clientX - boundingRect.left;
                _this._mouseY = event.touches[0].clientY - boundingRect.top;
                _this._whenCursorMoved();
            };
            this._whenCursorReleased = function (event) {
                if (!_this._dragging && _this._mouseDown) {
                    if (_this._mouseX < (_this._doc.barScrollPos + 8) * _this._barWidth) {
                        if (_this._doc.barScrollPos > 0)
                            _this._doc.barScrollPos--;
                        _this._doc.notifier.changed();
                    }
                    else {
                        if (_this._doc.barScrollPos < _this._doc.song.barCount - _this._doc.trackVisibleBars)
                            _this._doc.barScrollPos++;
                        _this._doc.notifier.changed();
                    }
                }
                _this._mouseDown = false;
                _this._dragging = false;
                _this._updatePreview();
            };
            var center = this._editorHeight * 0.5;
            var base = 20;
            var tip = 9;
            var arrowHeight = 6;
            this._leftHighlight.setAttribute("d", "M " + tip + " " + center + " L " + base + " " + (center + arrowHeight) + " L " + base + " " + (center - arrowHeight) + " z");
            this._rightHighlight.setAttribute("d", "M " + (this._editorWidth - tip) + " " + center + " L " + (this._editorWidth - base) + " " + (center + arrowHeight) + " L " + (this._editorWidth - base) + " " + (center - arrowHeight) + " z");
            this.container.addEventListener("mousedown", this._whenMousePressed);
            document.addEventListener("mousemove", this._whenMouseMoved);
            document.addEventListener("mouseup", this._whenCursorReleased);
            this.container.addEventListener("mouseover", this._whenMouseOver);
            this.container.addEventListener("mouseout", this._whenMouseOut);
            this.container.addEventListener("touchstart", this._whenTouchPressed);
            this.container.addEventListener("touchmove", this._whenTouchMoved);
            this.container.addEventListener("touchend", this._whenCursorReleased);
            this.container.addEventListener("touchcancel", this._whenCursorReleased);
            this._trackContainer.addEventListener("scroll", this._onScroll, { capture: false, passive: true });
        }
        BarScrollBar.prototype._whenCursorMoved = function () {
            if (this._dragging) {
                while (this._mouseX - this._dragStart < -this._barWidth * 0.5) {
                    if (this._doc.barScrollPos > 0) {
                        this._doc.barScrollPos--;
                        this._dragStart -= this._barWidth;
                        this._doc.notifier.changed();
                    }
                    else {
                        break;
                    }
                }
                while (this._mouseX - this._dragStart > this._barWidth * 0.5) {
                    if (this._doc.barScrollPos < this._doc.song.barCount - this._doc.trackVisibleBars) {
                        this._doc.barScrollPos++;
                        this._dragStart += this._barWidth;
                        this._doc.notifier.changed();
                    }
                    else {
                        break;
                    }
                }
            }
            if (this._mouseOver)
                this._updatePreview();
        };
        BarScrollBar.prototype._updatePreview = function () {
            var showHighlight = this._mouseOver && !this._mouseDown;
            var showleftHighlight = false;
            var showRightHighlight = false;
            var showHandleHighlight = false;
            if (showHighlight) {
                if (this._mouseX < this._doc.barScrollPos * this._barWidth) {
                    showleftHighlight = true;
                }
                else if (this._mouseX > (this._doc.barScrollPos + this._doc.trackVisibleBars) * this._barWidth) {
                    showRightHighlight = true;
                }
                else {
                    showHandleHighlight = true;
                }
            }
            this._leftHighlight.style.visibility = showleftHighlight ? "visible" : "hidden";
            this._rightHighlight.style.visibility = showRightHighlight ? "visible" : "hidden";
            this._handleHighlight.style.visibility = showHandleHighlight ? "visible" : "hidden";
        };
        BarScrollBar.prototype.render = function () {
            this._barWidth = (this._editorWidth - 1) / Math.max(this._doc.trackVisibleBars, this._doc.song.barCount);
            var resized = this._renderedNotchCount != this._doc.song.barCount;
            if (resized) {
                this._renderedNotchCount = this._doc.song.barCount;
                while (this._notches.firstChild)
                    this._notches.removeChild(this._notches.firstChild);
                for (var i = 0; i <= this._doc.song.barCount; i++) {
                    var lineHeight = (i % 16 == 0) ? 0 : ((i % 4 == 0) ? this._editorHeight / 8 : this._editorHeight / 3);
                    this._notches.appendChild(beepbox.svgElement("rect", { fill: "#444444", x: i * this._barWidth - 1, y: lineHeight, width: 2, height: this._editorHeight - lineHeight * 2 }));
                }
            }
            if (resized || this._renderedBarPos != this._doc.barScrollPos) {
                this._renderedBarPos = this._doc.barScrollPos;
                this._handle.setAttribute("x", "" + (this._barWidth * this._doc.barScrollPos));
                this._handle.setAttribute("width", "" + (this._barWidth * this._doc.trackVisibleBars));
                this._handleHighlight.setAttribute("x", "" + (this._barWidth * this._doc.barScrollPos));
                this._handleHighlight.setAttribute("width", "" + (this._barWidth * this._doc.trackVisibleBars));
            }
            this._updatePreview();
            this._trackContainer.scrollLeft = this._doc.barScrollPos * 32;
        };
        return BarScrollBar;
    }());
    beepbox.BarScrollBar = BarScrollBar;
})(beepbox || (beepbox = {}));
// Octave scrollbar for pitched channels.
var beepbox;
(function (beepbox) {
    var OctaveScrollBar = (function () {
        function OctaveScrollBar(_doc) {
            var _this = this;
            this._doc = _doc;
            this._editorWidth = 20;
            this._editorHeight = 481;
            this._notchHeight = 4.0;
            this._octaveCount = 7;
            this._octaveHeight = (this._editorHeight - this._notchHeight) / this._octaveCount;
            this._barHeight = (this._octaveHeight * 3 + this._notchHeight);
            this._handle = beepbox.svgElement("rect", { fill: sliderOctaveColorPallet[_this._doc.song.theme], x: 2, y: 0, width: this._editorWidth - 4, height: this._barHeight });
            this._handleHighlight = beepbox.svgElement("rect", { fill: "none", stroke: "white", "stroke-width": 2, "pointer-events": "none", x: 1, y: 0, width: this._editorWidth - 2, height: this._barHeight });
            this._upHighlight = beepbox.svgElement("path", { fill: "white", "pointer-events": "none" });
            this._downHighlight = beepbox.svgElement("path", { fill: "white", "pointer-events": "none" });
            this._svg = beepbox.svgElement("svg", { style: "background-color: #000000; touch-action: pan-x; position: absolute;", width: this._editorWidth, height: "100%", viewBox: "0 0 20 481", preserveAspectRatio: "none" });
            this.container = beepbox.html.div({ id: "octaveScrollBarContainer", style: "width: 20px; height: 100%; overflow: hidden; position: relative; flex-shrink: 0;" }, [this._svg]);
            this._mouseX = 0;
            this._mouseY = 0;
            this._mouseDown = false;
            this._mouseOver = false;
            this._dragging = false;
            this._renderedBarBottom = -1;
            this._change = null;
            this._whenMouseOver = function (event) {
                if (_this._mouseOver)
                    return;
                _this._mouseOver = true;
                _this._updatePreview();
            };
            this._whenMouseOut = function (event) {
                if (!_this._mouseOver)
                    return;
                _this._mouseOver = false;
                _this._updatePreview();
            };
            this._whenMousePressed = function (event) {
                event.preventDefault();
                _this._mouseDown = true;
                var boundingRect = _this._svg.getBoundingClientRect();
                _this._mouseX = (event.clientX || event.pageX) - boundingRect.left;
                _this._mouseY = ((event.clientY || event.pageY) - boundingRect.top) * _this._editorHeight / (boundingRect.bottom - boundingRect.top);
                if (isNaN(_this._mouseY))
                    _this._mouseY = 0;
                if (_this._doc.song.getChannelIsDrum(_this._doc.channel))
                    return;
                _this._updatePreview();
                if (_this._mouseY >= _this._barBottom - _this._barHeight && _this._mouseY <= _this._barBottom) {
                    _this._dragging = true;
                    _this._change = null;
                    _this._dragStart = _this._mouseY;
                }
            };
            this._whenTouchPressed = function (event) {
                event.preventDefault();
                _this._mouseDown = true;
                var boundingRect = _this._svg.getBoundingClientRect();
                _this._mouseX = event.touches[0].clientX - boundingRect.left;
                _this._mouseY = (event.touches[0].clientY - boundingRect.top) * _this._editorHeight / (boundingRect.bottom - boundingRect.top);
                if (isNaN(_this._mouseY))
                    _this._mouseY = 0;
                if (_this._doc.song.getChannelIsDrum(_this._doc.channel))
                    return;
                _this._updatePreview();
                if (_this._mouseY >= _this._barBottom - _this._barHeight && _this._mouseY <= _this._barBottom) {
                    _this._dragging = true;
                    _this._change = null;
                    _this._dragStart = _this._mouseY;
                }
            };
            this._whenMouseMoved = function (event) {
                var boundingRect = _this._svg.getBoundingClientRect();
                _this._mouseX = (event.clientX || event.pageX) - boundingRect.left;
                _this._mouseY = ((event.clientY || event.pageY) - boundingRect.top) * _this._editorHeight / (boundingRect.bottom - boundingRect.top);
                if (isNaN(_this._mouseY))
                    _this._mouseY = 0;
                _this._whenCursorMoved();
            };
            this._whenTouchMoved = function (event) {
                if (!_this._mouseDown)
                    return;
                event.preventDefault();
                var boundingRect = _this._svg.getBoundingClientRect();
                _this._mouseX = event.touches[0].clientX - boundingRect.left;
                _this._mouseY = (event.touches[0].clientY - boundingRect.top) * _this._editorHeight / (boundingRect.bottom - boundingRect.top);
                if (isNaN(_this._mouseY))
                    _this._mouseY = 0;
                _this._whenCursorMoved();
            };
            this._whenCursorReleased = function (event) {
                if (!_this._doc.song.getChannelIsDrum(_this._doc.channel) && _this._mouseDown) {
                    if (_this._dragging) {
                        if (_this._change != null)
                            _this._doc.record(_this._change);
                    }
                    else {
                        var canReplaceLastChange = _this._doc.lastChangeWas(_this._change);
                        var oldValue = canReplaceLastChange ? _this._change.oldValue : _this._doc.song.channels[_this._doc.channel].octave;
                        var currentOctave = _this._doc.song.channels[_this._doc.channel].octave;
                        if (_this._mouseY < _this._barBottom - _this._barHeight * 0.5) {
                            if (currentOctave < 4) {
                                _this._change = new beepbox.ChangeOctave(_this._doc, oldValue, currentOctave + 1);
                                _this._doc.record(_this._change, canReplaceLastChange);
                            }
                        }
                        else {
                            if (currentOctave > 0) {
                                _this._change = new beepbox.ChangeOctave(_this._doc, oldValue, currentOctave - 1);
                                _this._doc.record(_this._change, canReplaceLastChange);
                            }
                        }
                    }
                }
                _this._mouseDown = false;
                _this._dragging = false;
                _this._updatePreview();
            };
            this._documentChanged = function () {
                _this._barBottom = _this._editorHeight - (_this._octaveHeight * _this._doc.song.channels[_this._doc.channel].octave);
                _this._render();
            };
            this._doc.notifier.watch(this._documentChanged);
            this._documentChanged();
            this._svg.appendChild(this._handle);
            for (var i = 0; i <= this._octaveCount; i++) {
                this._svg.appendChild(beepbox.svgElement("rect", { fill: sliderOctaveNotchColorPallet[_this._doc.song.theme], x: 0, y: i * this._octaveHeight, width: this._editorWidth, height: this._notchHeight }));
            }
            this._svg.appendChild(this._handleHighlight);
            this._svg.appendChild(this._upHighlight);
            this._svg.appendChild(this._downHighlight);
            var center = this._editorWidth * 0.5;
            var base = 20;
            var tip = 9;
            var arrowWidth = 6;
            this._upHighlight.setAttribute("d", "M " + center + " " + tip + " L " + (center + arrowWidth) + " " + base + " L " + (center - arrowWidth) + " " + base + " z");
            this._downHighlight.setAttribute("d", "M " + center + " " + (this._editorHeight - tip) + " L " + (center + arrowWidth) + " " + (this._editorHeight - base) + " L " + (center - arrowWidth) + " " + (this._editorHeight - base) + " z");
            this.container.addEventListener("mousedown", this._whenMousePressed);
            document.addEventListener("mousemove", this._whenMouseMoved);
            document.addEventListener("mouseup", this._whenCursorReleased);
            this.container.addEventListener("mouseover", this._whenMouseOver);
            this.container.addEventListener("mouseout", this._whenMouseOut);
            this.container.addEventListener("touchstart", this._whenTouchPressed);
            this.container.addEventListener("touchmove", this._whenTouchMoved);
            this.container.addEventListener("touchend", this._whenCursorReleased);
            this.container.addEventListener("touchcancel", this._whenCursorReleased);
        }
        OctaveScrollBar.prototype._whenCursorMoved = function () {
            if (this._doc.song.getChannelIsDrum(this._doc.channel))
                return;
            if (this._dragging) {
                var currentOctave = this._doc.song.channels[this._doc.channel].octave;
                var continuingProspectiveChange = this._doc.lastChangeWas(this._change);
                var oldValue = continuingProspectiveChange ? this._change.oldValue : currentOctave;
                var octave = currentOctave;
                while (this._mouseY - this._dragStart < -this._octaveHeight * 0.5) {
                    if (octave < 4) {
                        octave++;
                        this._dragStart -= this._octaveHeight;
                    }
                    else {
                        break;
                    }
                }
                while (this._mouseY - this._dragStart > this._octaveHeight * 0.5) {
                    if (octave > 0) {
                        octave--;
                        this._dragStart += this._octaveHeight;
                    }
                    else {
                        break;
                    }
                }
                this._change = new beepbox.ChangeOctave(this._doc, oldValue, octave);
                this._doc.setProspectiveChange(this._change);
            }
            if (this._mouseOver)
                this._updatePreview();
        };
        OctaveScrollBar.prototype._updatePreview = function () {
            var showHighlight = this._mouseOver && !this._mouseDown;
            var showUpHighlight = false;
            var showDownHighlight = false;
            var showHandleHighlight = false;
            if (showHighlight) {
                if (this._mouseY < this._barBottom - this._barHeight) {
                    showUpHighlight = true;
                }
                else if (this._mouseY > this._barBottom) {
                    showDownHighlight = true;
                }
                else {
                    showHandleHighlight = true;
                }
            }
            this._upHighlight.style.visibility = showUpHighlight ? "inherit" : "hidden";
            this._downHighlight.style.visibility = showDownHighlight ? "inherit" : "hidden";
            this._handleHighlight.style.visibility = showHandleHighlight ? "inherit" : "hidden";
        };
        OctaveScrollBar.prototype._render = function () {
            this._svg.style.visibility = (this._doc.song.getChannelIsDrum(this._doc.channel)) ? "hidden" : "visible";
            if (this._renderedBarBottom != this._barBottom) {
                this._renderedBarBottom = this._barBottom;
                this._handle.setAttribute("y", "" + (this._barBottom - this._barHeight));
                this._handleHighlight.setAttribute("y", "" + (this._barBottom - this._barHeight));
            }
            this._updatePreview();
        };
        return OctaveScrollBar;
    }());
    beepbox.OctaveScrollBar = OctaveScrollBar;
})(beepbox || (beepbox = {}));
// Piano/drum keyboard preview and audition widget.
var beepbox;
(function (beepbox) {
    var loadedCount = 0;
    var finishedLoadingImages = false;
    function onLoaded() {
        loadedCount++;
        finishedLoadingImages = true;
    }
    var BlackKey = document.createElement("img");
    BlackKey.onload = onLoaded;
    BlackKey.src = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAANCAIAAABHKvtLAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAAyJpVFh0WE1MOmNvbS5hZG9iZS54bXAAAAAAADw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVNME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+IDx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2JlIFhNUCBDb3JlIDUuMC1jMDYwIDYxLjEzNDc3NywgMjAxMC8wMi8xMi0xNzozMjowMCAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvIiB4bWxuczp4bXBNTT0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL21tLyIgeG1sbnM6c3RSZWY9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9zVHlwZS9SZXNvdXJjZVJlZiMiIHhtcDpDcmVhdG9yVG9vbD0iQWRvYmUgUGhvdG9zaG9wIENTNSBNYWNpbnRvc2giIHhtcE1NOkluc3RhbmNlSUQ9InhtcC5paWQ6NEU3RTM2RTg0NzBEMTFFMTgyMjBBREEyQTVGRDY5MjIiIHhtcE1NOkRvY3VtZW50SUQ9InhtcC5kaWQ6NEU3RTM2RTk0NzBEMTFFMTgyMjBBREEyQTVGRDY5MjIiPiA8eG1wTU06RGVyaXZlZEZyb20gc3RSZWY6aW5zdGFuY2VJRD0ieG1wLmlpZDozMzYxN0U3RDQ3MEQxMUUxODIyMEFEQTJBNUZENjkyMiIgc3RSZWY6ZG9jdW1lbnRJRD0ieG1wLmRpZDozMzYxN0U3RTQ3MEQxMUUxODIyMEFEQTJBNUZENjkyMiIvPiA8L3JkZjpEZXNjcmlwdGlvbj4gPC9yZGY6UkRGPiA8L3g6eG1wbWV0YT4gPD94cGFja2V0IGVuZD0iciI/PomGIaQAAABgSURBVHjaYpSWlmZhYWFmZgaSTExMQAYTGGAyIICRkRFIMhANWISFhdlggAUHANrBysoKNBfuCGKMvnjx4r59+xhp5wOg6UCSBM+SB0YtGLVgCFgAzDeMeOSGgAUAAQYAGgwJrOg8pdQAAAAASUVORK5CYII=";
    var BlackKeyDisabled = document.createElement("img");
    BlackKeyDisabled.onload = onLoaded;
    BlackKeyDisabled.src = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAANCAIAAABHKvtLAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAAyJpVFh0WE1MOmNvbS5hZG9iZS54bXAAAAAAADw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVNME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+IDx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2JlIFhNUCBDb3JlIDUuMC1jMDYwIDYxLjEzNDc3NywgMjAxMC8wMi8xMi0xNzozMjowMCAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvIiB4bWxuczp4bXBNTT0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL21tLyIgeG1sbnM6c3RSZWY9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9zVHlwZS9SZXNvdXJjZVJlZiMiIHhtcDpDcmVhdG9yVG9vbD0iQWRvYmUgUGhvdG9zaG9wIENTNSBNYWNpbnRvc2giIHhtcE1NOkluc3RhbmNlSUQ9InhtcC5paWQ6NEU3RTM2RUM0NzBEMTFFMTgyMjBBREEyQTVGRDY5MjIiIHhtcE1NOkRvY3VtZW50SUQ9InhtcC5kaWQ6NEU3RTM2RUQ0NzBEMTFFMTgyMjBBREEyQTVGRDY5MjIiPiA8eG1wTU06RGVyaXZlZEZyb20gc3RSZWY6aW5zdGFuY2VJRD0ieG1wLmlpZDo0RTdFMzZFQTQ3MEQxMUUxODIyMEFEQTJBNUZENjkyMiIgc3RSZWY6ZG9jdW1lbnRJRD0ieG1wLmRpZDo0RTdFMzZFQjQ3MEQxMUUxODIyMEFEQTJBNUZENjkyMiIvPiA8L3JkZjpEZXNjcmlwdGlvbj4gPC9yZGY6UkRGPiA8L3g6eG1wbWV0YT4gPD94cGFja2V0IGVuZD0iciI/PhURscAAAAB1SURBVHja7NPBCoAgDAZgnaMX8Oj7P2KKldXPhiR4CwwCv4PInPvxoA0hMLNzDisRYUPCCiMucVallJzzJnaBih5pp2mw936puKEZ2qQ3MeUQmLiKGGNKCZ1IQr2fDnb0C8gMNgNmwA8Cnt/0Tv91vw64BRgALUuP70jrlrwAAAAASUVORK5CYII=";
    var WhiteKey = document.createElement("img");
    WhiteKey.onload = onLoaded;
    WhiteKey.src = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAANCAIAAABHKvtLAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAAyJpVFh0WE1MOmNvbS5hZG9iZS54bXAAAAAAADw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVNME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+IDx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2JlIFhNUCBDb3JlIDUuMC1jMDYwIDYxLjEzNDc3NywgMjAxMC8wMi8xMi0xNzozMjowMCAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvIiB4bWxuczp4bXBNTT0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL21tLyIgeG1sbnM6c3RSZWY9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9zVHlwZS9SZXNvdXJjZVJlZiMiIHhtcDpDcmVhdG9yVG9vbD0iQWRvYmUgUGhvdG9zaG9wIENTNSBNYWNpbnRvc2giIHhtcE1NOkluc3RhbmNlSUQ9InhtcC5paWQ6MzM2MTdFNzc0NzBEMTFFMTgyMjBBREEyQTVGRDY5MjIiIHhtcE1NOkRvY3VtZW50SUQ9InhtcC5kaWQ6MzM2MTdFNzg0NzBEMTFFMTgyMjBBREEyQTVGRDY5MjIiPiA8eG1wTU06RGVyaXZlZEZyb20gc3RSZWY6aW5zdGFuY2VJRD0ieG1wLmlpZDozMzYxN0U3NTQ3MEQxMUUxODIyMEFEQTJBNUZENjkyMiIgc3RSZWY6ZG9jdW1lbnRJRD0ieG1wLmRpZDozMzYxN0U3NjQ3MEQxMUUxODIyMEFEQTJBNUZENjkyMiIvPiA8L3JkZjpEZXNjcmlwdGlvbj4gPC9yZGY6UkRGPiA8L3g6eG1wbWV0YT4gPD94cGFja2V0IGVuZD0iciI/PgBmMXoAAACTSURBVHja7JQ7CgMhGIT3920M2Hko7+RJPYWViE0myi5sEXAhKQL7FcP8PmawkWKMjx2llNb60MNIKY0xnPPphRDbMsJ7/xw458wAodZa6PRQ5GIF0RjlYCU655xSEqWU3ntrrdb63RcgHcq2H3MX3AV/UEAhBL7DBkTEzmAFuzSY44UC/BDHtU+8z539esFLgAEAkZ4XCDjZXPEAAAAASUVORK5CYII=";
    var WhiteKeyDisabled = document.createElement("img");
    WhiteKeyDisabled.onload = onLoaded;
    WhiteKeyDisabled.src = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAANCAIAAABHKvtLAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAAyJpVFh0WE1MOmNvbS5hZG9iZS54bXAAAAAAADw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVNME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+IDx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2JlIFhNUCBDb3JlIDUuMC1jMDYwIDYxLjEzNDc3NywgMjAxMC8wMi8xMi0xNzozMjowMCAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvIiB4bWxuczp4bXBNTT0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL21tLyIgeG1sbnM6c3RSZWY9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9zVHlwZS9SZXNvdXJjZVJlZiMiIHhtcDpDcmVhdG9yVG9vbD0iQWRvYmUgUGhvdG9zaG9wIENTNSBNYWNpbnRvc2giIHhtcE1NOkluc3RhbmNlSUQ9InhtcC5paWQ6MzM2MTdFN0I0NzBEMTFFMTgyMjBBREEyQTVGRDY5MjIiIHhtcE1NOkRvY3VtZW50SUQ9InhtcC5kaWQ6MzM2MTdFN0M0NzBEMTFFMTgyMjBBREEyQTVGRDY5MjIiPiA8eG1wTU06RGVyaXZlZEZyb20gc3RSZWY6aW5zdGFuY2VJRD0ieG1wLmlpZDozMzYxN0U3OTQ3MEQxMUUxODIyMEFEQTJBNUZENjkyMiIgc3RSZWY6ZG9jdW1lbnRJRD0ieG1wLmRpZDozMzYxN0U3QTQ3MEQxMUUxODIyMEFEQTJBNUZENjkyMiIvPiA8L3JkZjpEZXNjcmlwdGlvbj4gPC9yZGY6UkRGPiA8L3g6eG1wbWV0YT4gPD94cGFja2V0IGVuZD0iciI/PlZjoH4AAADHSURBVHja7JTNDoMgEIRBGq21iTcfyvd/DeNvJBYBp7uFEE+99NDE70AMMDPLYZRt2z4CeZ4XRcFrRkgphRD7vnvvX8RGdF03DEPf99M0LcuitcamMcZa6wkRuNV1/SSqqroTcC/LEu5KKQ6AEhq21oRzDl5bAME8DUjd3wHjOELPyu9fgNnneV7XNQ6OyNPsTCZ+zBVwBfxBgGyaRgViuWIt+ZIPuAAaZwh00BKxaKeuSfwhUsfI55g+WOMT2DEl3jm94BBgAAtY6T6d3wTNAAAAAElFTkSuQmCC";
    var Drum = document.createElement("img");
    Drum.onload = onLoaded;
    Drum.src = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAArCAIAAACW3x1gAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAA2ZpVFh0WE1MOmNvbS5hZG9iZS54bXAAAAAAADw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVNME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+IDx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2JlIFhNUCBDb3JlIDUuMC1jMDYwIDYxLjEzNDc3NywgMjAxMC8wMi8xMi0xNzozMjowMCAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wTU09Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9tbS8iIHhtbG5zOnN0UmVmPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvc1R5cGUvUmVzb3VyY2VSZWYjIiB4bWxuczp4bXA9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC8iIHhtcE1NOk9yaWdpbmFsRG9jdW1lbnRJRD0ieG1wLmRpZDowMTgwMTE3NDA3MjA2ODExOUJCOEEzOUJCMkI3MTdFNCIgeG1wTU06RG9jdW1lbnRJRD0ieG1wLmRpZDo5NzVEOTA1QzQ5MjMxMUUxOTM3RDhDNEI4QkIxQkFCNSIgeG1wTU06SW5zdGFuY2VJRD0ieG1wLmlpZDo5NzVEOTA1QjQ5MjMxMUUxOTM3RDhDNEI4QkIxQkFCNSIgeG1wOkNyZWF0b3JUb29sPSJBZG9iZSBQaG90b3Nob3AgQ1M1IE1hY2ludG9zaCI+IDx4bXBNTTpEZXJpdmVkRnJvbSBzdFJlZjppbnN0YW5jZUlEPSJ4bXAuaWlkOjAxODAxMTc0MDcyMDY4MTE5QkI4QTM5QkIyQjcxN0U0IiBzdFJlZjpkb2N1bWVudElEPSJ4bXAuZGlkOjAxODAxMTc0MDcyMDY4MTE5QkI4QTM5QkIyQjcxN0U0Ii8+IDwvcmRmOkRlc2NyaXB0aW9uPiA8L3JkZjpSREY+IDwveDp4bXBtZXRhPiA8P3hwYWNrZXQgZW5kPSJyIj8+dtFK5QAACbRJREFUeNrcV0lsG9cZnnmzcJdIcRHFRZtly5IVSVYSOcriNY7jqHHTBE2bJkCRNijQQ9re2kOBAj30kByKAm1PvQVF0RYIkLRpkiZuLMqyLVm7bGvlIpKiuHOGyww52+ubIbXYCYLk2P4ccobz3nzf+9f3D4b9rwv+5cOXL5x48crDT54b8Pr6jOZWQJoxKIi13WJ+Oziz+Z/r6x9N3AvMhb42gcWkf/P1Mz/40fkWz2iuAAsFrljkOK5crVYwTNTrcaMRNDURNhtl1Slrn9x55x+zf/5ooVIVvhLBq1ce+eXPLpt6RnZ22EIBmk1Oi8VuMFoMBgNF6RUMF2tcrVqscPlSKcGV4zaC85qNd25u/PHdm/+8tf5lBBRJ/Oan49/98cVEDmcYg9PZ09LSrjcYSRzHcAAxDGBQQfMgJiuyAiFUFMSUT23mtu9YxYxVgX/6YPa3796QZGUfk9i/Mhvo3//8W99443wwKtB0T1fXqM3m0en0iJUgSIIkKYoiKBL9A4QqAEcCSFJnbnI3uboqIpHP7D7T73WYDbfW4+IexwHB22+OX3zpsfAu5nI96vUM0gY9wqN0JEJG2AAATFs7hlABrhKgk3qJQwwCgrY4/ZiuaSceO+VvslkM11Yi9xG8+dLj33/tdDgLPB1POB09JE0RAOESFEEiVOWQaIZBPxCtX2MBUKVRMAXTWZyk2RaPRp440lIV5PngboPgZE/br16/kBJwR9dTTtdxQkejBzUOoHxO4P2CCAgcV+8iDSHUWWyA0ieDa4N++1J4N8VUVMVfvTCEm/S0vc/Z1g9IoKIjU6PHkCBvyrJ63hMJffZ+tQkyDnDVPThR18beM6zvHmky0i8/OYDAwTGvfXz0WKoCXL5BFVv1p0qgmULRMJTD0HVKWdqj1EZVS2meV+MNU1zHTmZE6tLJ7qOeFvLMQ504TRkt3SarC00j1aOBrhmksUxFu4PuNxytAqHAhZj2Bw2h6Kprgym40d5m9PXqmbXTA53gzIA/V+KaXZ3aTBSCuKrpniDMOo+yv/bGr3qCyv46VE8jDVCmIBT0t7mtK1fkn+rzgpPdrWy5arS2qloCXHMWdp8flYatZGVPm7rd7nc6psUV0BgQgsnhYbnacGcr8DltXE3UGZsxFNA4JAgcUzU/RHDoWsOFh2Pp8ES0OnX9anWAtNnK1wSf00paTIZG0UAhV19+4/uAHNCqc2Hj3n2CDCxDWRvU1FCLJuB43qijahyLiFG2wEZ5wr+gLOKac7USUX/+gVlQ1pahsdZKjEFHcxwPWIZpNus5JgUhPICqY+1B4XvAQItHrUjsDR6aiRRT9gAq2USzUccyLNhNpe0WI5uOYFrEoAPDDqHvoSJMcJ8Q+7f3J6rxIGP1hbKJsN1iQOAgtJNutZu5bKjEpmU1HNXQeABcKzsNIfeKqVbv8H0OLbCgamQIuXySS6y7rOZQIgO2M2WsxrealHRsSdEiW5Kkfez6uV47Dyg0+ANzgUbqIAfXDZBZn3eSoiJUorkyoMzW9bW1Tk+LkFtNJ1YQPApESZFAAxqAQ9jEYZK6aKPItJJaPdRPdmupGlnocDWvra4hcHCi7/jdxXtihe3yWFKx2+lsUJZESVKLxAH2F1A0wNEAsrooC5Ko5ggb38wsBbps+mqZXVxZHeg7Dvq7vYlo+c78vN9t7fSARPxmMrmuCKIgSfUqRnwxeEOQZQRBRnpDWcxur6QWPm3XcT67eX5uLrHD93V5SSOsWk2ttwMLNp9rePwiyZbC0Vs8X/R5T+gNFog41F2SOEjdevRrXhVFUS2sklTjSsmt21xw7ogZ8za3XEcyvdzS3KOXeeInlx9iC3IikqkKCZ2ROjr6kKXJVCjsRqMx9CRBGpHBkWXrW1g9nRG0pNpRRGav8Gw6thy995mhuHW81eSxmK4HpiYnrzNFU9+xXp/XQLz8aIel2RqeTZZrNVHYJYDi7u7s6OqkaaJQSEajYYbJ8xwvSgJaLDI3YuW5EsNkc7lIYmchEbtJC9tHHFS/z6GUuclrE4GJwG6BBpJ1bKy3WGXJ5WDs+WfOOX0t+UgmaqieOM1uXP2Xb/iUv+Nhv7+DYYRstlIoZLYj259rvMg2D+mwuq2ohjL81vTC8tQ0hyk7eRpyTd52W09P6/uBKXLmXuSlK7D3VM+tSAZugv7Lb3349otCOe3OxW3+oWb7gNXqwDAdhqHdX0I1BsNQ+8ZjWBXDOHQh88XY3EpoZml1ZjGdLP/ivX9cffcVtKcPDXdStHJ7bZtcjGS2Ntb7xwbDs2F2K4UX37rzMcOOQoN5RSpuNbnnjPYjlMkP6DaIm1AfpDZdQqlWSVVyMSYeTm5sJtZCHMOHd2q7O2T449+hXdPvd5wc7tpYX12OZslIEd6YWe4a7h+8PHT9D5/GVxhXEiTey2eC1aOnnINnUUuUx2vLtIGUqlKVq/FlgWf5ClstM1yF4Zk0F4zUIiGhkiLNgNxeLaDUfvzxXkAIgfmV7TJGcBJGSJUeFz36wllBlP/+6+suknQSlCGthGfyK7PpWKhcydckUYtRHBN5KZ/m4qHS+jK7OFNYmC6mNyRzlTIRSDlseT537uzApUvDk4HAX29s3C2olsUWk9K/r06jPBj94WmlJu68v4RuNpGEkzLCNJbbza98mL4qiowsj35vOLZVWL8VpnFcDwA6/AQt62FVwQSo7iVjj/WOP/fwzVs3PpicvVuAjcarJKhrawM5i8My+NoFqSxVtlKEApE1DQA4KKqd1nXrdb1Gw/jf/jL2/KPyO5+00bSVotCoorkexS9OkWPnB158eWxpbnYiEPgsrmyyh1rHGCOhztkF07SJOHrlrMnTVo3nFKaCdmgSRxs56kXU3a79lZ3NTz/JLORFXkG4yGwSVNFt7Y6nvzM2dubo7NTUxLVrEzH5Zgo+2PyGswJqarwUq0gV92ivf/wSbbFIGRayZVSP1WqM47pHbKH5TC3MCRW5TmBpt498e/TZN85RRHn6s4mF2flAVJ5Mavb6/K6K2pZvPuZ45ZK364jTfXzE2j5EQn95LsyvbJXWQ+VofDIci4vC00d9lMdlOuZ2DHndI242EgqjPJheiCdLE1vVqYSswC99wznVZ33hvOfKxQ5Ts6HJ3X0oD8xaHlQVoVCrJCq5OLMTSm5sJO4FObY6tVqcCnJrWfkrvaPpaXBxzP3sOd9zT3fYXSa9kab0lFhFVRPlAepAahUWJUEV5UE2XZ5azE6vl+YivCDDr/2WOdzfcmqkdWTINXDC4XXpzTqiWq7F42wwyKxuFO5sMneDxc0Ej/0/y38FGACBHjS0mkQ17AAAAABJRU5ErkJggg==";
    var Piano = (function () {
        function Piano(_doc) {
            var _this = this;
            this._doc = _doc;
            this._canvas = beepbox.html.canvas({ width: "32", height: "481", style: "width: 100%; height: 100%;" });
            this._preview = beepbox.html.canvas({ width: "32", height: "40" });
            this.container = beepbox.html.div({ style: "width: 32px; height: 100%; overflow:hidden; position: relative; flex-shrink: 0; touch-action: none;" }, [
                this._canvas,
                this._preview,
            ]);
            this._graphics = this._canvas.getContext("2d");
            this._previewGraphics = this._preview.getContext("2d");
            this._editorWidth = 32;
            this._editorHeight = 481;
            this._mouseX = 0;
            this._mouseY = 0;
            this._mouseDown = false;
            this._mouseOver = false;
            this._renderedScale = -1;
            this._renderedDrums = false;
            this._renderedKey = -1;
            this._whenMouseOver = function (event) {
                if (_this._mouseOver)
                    return;
                _this._mouseOver = true;
                _this._updatePreview();
            };
            this._whenMouseOut = function (event) {
                if (!_this._mouseOver)
                    return;
                _this._mouseOver = false;
                _this._updatePreview();
            };
            this._whenMousePressed = function (event) {
                event.preventDefault();
                _this._mouseDown = true;
                var boundingRect = _this._canvas.getBoundingClientRect();
                _this._mouseX = (event.clientX || event.pageX) - boundingRect.left;
                _this._mouseY = ((event.clientY || event.pageY) - boundingRect.top) * _this._editorHeight / (boundingRect.bottom - boundingRect.top);
                if (isNaN(_this._mouseY))
                    _this._mouseY = 0;
                _this._doc.synth.pianoPressed = true;
                _this._updatePreview();
            };
            this._whenMouseMoved = function (event) {
                var boundingRect = _this._canvas.getBoundingClientRect();
                _this._mouseX = (event.clientX || event.pageX) - boundingRect.left;
                _this._mouseY = ((event.clientY || event.pageY) - boundingRect.top) * _this._editorHeight / (boundingRect.bottom - boundingRect.top);
                if (isNaN(_this._mouseY))
                    _this._mouseY = 0;
                _this._updateCursorPitch();
                _this._doc.synth.pianoPitch[0] = _this._cursorPitch + _this._doc.song.channels[_this._doc.channel].octave * 12;
                _this._updatePreview();
            };
            this._whenMouseReleased = function (event) {
                _this._mouseDown = false;
                _this._doc.synth.pianoPressed = false;
                _this._updatePreview();
            };
            this._whenTouchPressed = function (event) {
                event.preventDefault();
                _this._mouseDown = true;
                var boundingRect = _this._canvas.getBoundingClientRect();
                _this._mouseX = event.touches[0].clientX - boundingRect.left;
                _this._mouseY = (event.touches[0].clientY - boundingRect.top) * _this._editorHeight / (boundingRect.bottom - boundingRect.top);
                if (isNaN(_this._mouseY))
                    _this._mouseY = 0;
                _this._updateCursorPitch();
                _this._doc.synth.pianoPressed = true;
                _this._doc.synth.pianoPitch[0] = _this._cursorPitch + _this._doc.song.channels[_this._doc.channel].octave * 12;
            };
            this._whenTouchMoved = function (event) {
                event.preventDefault();
                var boundingRect = _this._canvas.getBoundingClientRect();
                _this._mouseX = event.touches[0].clientX - boundingRect.left;
                _this._mouseY = (event.touches[0].clientY - boundingRect.top) * _this._editorHeight / (boundingRect.bottom - boundingRect.top);
                if (isNaN(_this._mouseY))
                    _this._mouseY = 0;
                _this._updateCursorPitch();
                _this._doc.synth.pianoPitch[0] = _this._cursorPitch + _this._doc.song.channels[_this._doc.channel].octave * 12;
            };
            this._whenTouchReleased = function (event) {
                event.preventDefault();
                _this._doc.synth.pianoPressed = false;
            };
            this._documentChanged = function () {
                var isDrum = _this._doc.song.getChannelIsDrum(_this._doc.channel);
                _this._pitchHeight = isDrum ? 40 : 13;
                _this._pitchCount = isDrum ? beepbox.Config.drumCount : beepbox.Config.pitchCount;
                _this._updateCursorPitch();
                _this._doc.synth.pianoPitch[0] = _this._cursorPitch + _this._doc.song.channels[_this._doc.channel].octave * 12;
                _this._doc.synth.pianoChannel = _this._doc.channel;
                _this._render();
            };
            this._render = function () {
                if (!finishedLoadingImages) {
                    window.requestAnimationFrame(_this._render);
                    return;
                }
                if (!_this._doc.showLetters)
                    return;
                var isDrum = _this._doc.song.getChannelIsDrum(_this._doc.channel);
                if (_this._renderedScale == _this._doc.song.scale && _this._renderedKey == _this._doc.song.key && _this._renderedDrums == isDrum)
                    return;
                _this._renderedScale = _this._doc.song.scale;
                _this._renderedKey = _this._doc.song.key;
                _this._renderedDrums = isDrum;
                _this._graphics.clearRect(0, 0, _this._editorWidth, _this._editorHeight);
                var key;
                for (var j = 0; j < _this._pitchCount; j++) {
                    var pitchNameIndex = (j + beepbox.Config.keyTransposes[_this._doc.song.key]) % 12;
                    if (isDrum) {
                        key = Drum;
                        var scale = 1.0 - (j / _this._pitchCount) * 0.35;
                        var offset = (1.0 - scale) * 0.5;
                        var x = key.width * offset;
                        var y = key.height * offset + _this._pitchHeight * (_this._pitchCount - j - 1);
                        var w = key.width * scale;
                        var h = key.height * scale;
                        _this._graphics.drawImage(key, x, y, w, h);
                        var brightness = 1.0 + ((j - _this._pitchCount / 2.0) / _this._pitchCount) * 0.5;
                        var imageData = _this._graphics.getImageData(x, y, w, h);
                        var data = imageData.data;
                        for (var i = 0; i < data.length; i += 4) {
                            data[i + 0] *= brightness;
                            data[i + 1] *= brightness;
                            data[i + 2] *= brightness;
                        }
                        _this._graphics.putImageData(imageData, x, y);
                    }
                    else if (!beepbox.Config.scaleFlags[_this._doc.song.scale][j % 12]) {
                        key = beepbox.Config.pianoScaleFlags[pitchNameIndex] ? WhiteKeyDisabled : BlackKeyDisabled;
                        _this._graphics.drawImage(key, 0, _this._pitchHeight * (_this._pitchCount - j - 1));
                    }
                    else {
                        var text = beepbox.Config.pitchNames[pitchNameIndex];
                        if (text == null) {
                            var shiftDir = beepbox.Config.blackKeyNameParents[j % 12];
                            text = beepbox.Config.pitchNames[(pitchNameIndex + 12 + shiftDir) % 12];
                            if (shiftDir == 1) {
                                text += "♭";
                            }
                            else if (shiftDir == -1) {
                                text += "♯";
                            }
                        }
                        var textColor = beepbox.Config.pianoScaleFlags[pitchNameIndex] ? "#000000" : buttonColorPallet[_this._doc.song.theme];
                        key = beepbox.Config.pianoScaleFlags[pitchNameIndex] ? WhiteKey : BlackKey;
                        _this._graphics.drawImage(key, 0, _this._pitchHeight * (_this._pitchCount - j - 1));
                        _this._graphics.font = "bold 11px sans-serif";
                        _this._graphics.fillStyle = textColor;
                        _this._graphics.fillText(text, 15, _this._pitchHeight * (_this._pitchCount - j) - 3);
                    }
                }
                _this._updatePreview();
            };
            this._doc.notifier.watch(this._documentChanged);
            this._documentChanged();
            this.container.addEventListener("mousedown", this._whenMousePressed);
            document.addEventListener("mousemove", this._whenMouseMoved);
            document.addEventListener("mouseup", this._whenMouseReleased);
            this.container.addEventListener("mouseover", this._whenMouseOver);
            this.container.addEventListener("mouseout", this._whenMouseOut);
            this.container.addEventListener("touchstart", this._whenTouchPressed);
            this.container.addEventListener("touchmove", this._whenTouchMoved);
            this.container.addEventListener("touchend", this._whenTouchReleased);
            this.container.addEventListener("touchcancel", this._whenTouchReleased);
        }
        Piano.prototype._updateCursorPitch = function () {
            var scale = beepbox.Config.scaleFlags[this._doc.song.scale];
            var mousePitch = Math.max(0, Math.min(this._pitchCount - 1, this._pitchCount - (this._mouseY / this._pitchHeight)));
            if (scale[Math.floor(mousePitch) % 12] || this._doc.song.getChannelIsDrum(this._doc.channel)) {
                this._cursorPitch = Math.floor(mousePitch);
            }
            else {
                var topPitch = Math.floor(mousePitch) + 1;
                var bottomPitch = Math.floor(mousePitch) - 1;
                while (!scale[topPitch % 12]) {
                    topPitch++;
                }
                while (!scale[(bottomPitch) % 12]) {
                    bottomPitch--;
                }
                var topRange = topPitch;
                var bottomRange = bottomPitch + 1;
                if (topPitch % 12 == 0 || topPitch % 12 == 7) {
                    topRange -= 0.5;
                }
                if (bottomPitch % 12 == 0 || bottomPitch % 12 == 7) {
                    bottomRange += 0.5;
                }
                this._cursorPitch = mousePitch - bottomRange > topRange - mousePitch ? topPitch : bottomPitch;
            }
        };
        Piano.prototype._updatePreview = function () {
            this._preview.style.visibility = (!this._mouseOver || this._mouseDown) ? "hidden" : "visible";
            if (!this._mouseOver || this._mouseDown)
                return;
            this._previewGraphics.clearRect(0, 0, 32, 40);
            this._preview.style.left = "0px";
            this._preview.style.top = this._pitchHeight * (this._pitchCount - this._cursorPitch - 1) + "px";
            this._previewGraphics.lineWidth = 2;
            this._previewGraphics.strokeStyle = "#ff7200";
            this._previewGraphics.strokeRect(1, 1, this._editorWidth - 2, this._pitchHeight - 2);
        };
        return Piano;
    }());
    beepbox.Piano = Piano;
})(beepbox || (beepbox = {}));
// Prompt: custom song size and channel counts.
var beepbox;
(function (beepbox) {
    var button = beepbox.html.button, div = beepbox.html.div, span = beepbox.html.span, input = beepbox.html.input, br = beepbox.html.br, text = beepbox.html.text;
    var SongDurationPrompt = (function () {
        function SongDurationPrompt(_doc, _songEditor) {
            var _this = this;
            this._doc = _doc;
            this._songEditor = _songEditor;
            this._beatsStepper = input({ style: "width: 3em; margin-left: 1em;", type: "number", step: "1" });
            this._barsStepper = input({ style: "width: 3em; margin-left: 1em;", type: "number", step: "1" });
            this._patternsStepper = input({ style: "width: 3em; margin-left: 1em;", type: "number", step: "1" });
            this._instrumentsStepper = input({ style: "width: 3em; margin-left: 1em;", type: "number", step: "1" });
            this._pitchChannelStepper = input({ style: "width: 3em; margin-left: 1em;", type: "number", step: "1" });
            this._drumChannelStepper = input({ style: "width: 3em; margin-left: 1em;", type: "number", step: "1" });
            this._volBendStepper = input({ style: "width: 3em; margin-left: 1em;", type: "number", step: "1" });
            this._okayButton = button({ style: "width:45%;" }, [text("Okay")]);
            this._cancelButton = button({ style: "width:45%;" }, [text("Cancel")]);
            this.container = div({ className: "prompt", style: "width: 250px;" }, [
                div({ style: "font-size: 2em" }, [text("Custom Song Size")]),
                div({ style: "display: flex; flex-direction: row; align-items: center; height: 2em; justify-content: flex-end;" }, [
                    div({ style: "text-align: right;" }, [
                        text("Beats per bar:"),
                        br(),
                        span({ style: "font-size: smaller; color: #888888;" }, [text("(Multiples of 3 or 4 are recommended)")]),
                    ]),
                    this._beatsStepper,
                ]),
                div({ style: "display: flex; flex-direction: row; align-items: center; height: 2em; justify-content: flex-end;" }, [
                    div({ style: "display: inline-block; text-align: right;" }, [
                        text("Bars per song:"),
                        br(),
                        span({ style: "font-size: smaller; color: #888888;" }, [text("(Multiples of 2 or 4 are recommended)")]),
                    ]),
                    this._barsStepper,
                ]),
                div({ style: "display: flex; flex-direction: row; align-items: center; height: 2em; justify-content: flex-end;" }, [
                    text("Patterns per channel:"),
                    this._patternsStepper,
                ]),
                div({ style: "display: flex; flex-direction: row; align-items: center; height: 2em; justify-content: flex-end;" }, [
                    text("Instruments per channel:"),
                    this._instrumentsStepper,
                ]),
                div({ style: "display: flex; flex-direction: row; align-items: center; height: 2em; justify-content: flex-end;" }, [
                    text("Number of pitch channels:"),
                    this._pitchChannelStepper,
                ]),
                div({ style: "display: flex; flex-direction: row; align-items: center; height: 2em; justify-content: flex-end;" }, [
                    text("Number of drum channels:"),
                    this._drumChannelStepper,
                ]),
                div({ style: "display: flex; flex-direction: row; justify-content: space-between;" }, [
                    this._okayButton,
                    this._cancelButton,
                ]),
            ]);
            this._close = function () {
                _this._doc.undo();
            };
            this.cleanUp = function () {
                _this._okayButton.removeEventListener("click", _this._saveChanges);
                _this._cancelButton.removeEventListener("click", _this._close);
                _this._beatsStepper.removeEventListener("keypress", SongDurationPrompt._validateKey);
                _this._barsStepper.removeEventListener("keypress", SongDurationPrompt._validateKey);
                _this._patternsStepper.removeEventListener("keypress", SongDurationPrompt._validateKey);
                _this._instrumentsStepper.removeEventListener("keypress", SongDurationPrompt._validateKey);
                _this._pitchChannelStepper.removeEventListener("keypress", SongDurationPrompt._validateKey);
                _this._drumChannelStepper.removeEventListener("keypress", SongDurationPrompt._validateKey);
                _this._volBendStepper.removeEventListener("keypress", SongDurationPrompt._validateKey);
                _this._beatsStepper.removeEventListener("blur", SongDurationPrompt._validateNumber);
                _this._barsStepper.removeEventListener("blur", SongDurationPrompt._validateNumber);
                _this._patternsStepper.removeEventListener("blur", SongDurationPrompt._validateNumber);
                _this._instrumentsStepper.removeEventListener("blur", SongDurationPrompt._validateNumber);
                _this._pitchChannelStepper.removeEventListener("blur", SongDurationPrompt._validateNumber);
                _this._drumChannelStepper.removeEventListener("blur", SongDurationPrompt._validateNumber);
                _this._volBendStepper.removeEventListener("blur", SongDurationPrompt._validateNumber);
            };
            this._saveChanges = function () {
                var group = new beepbox.ChangeGroup();
                group.append(new beepbox.ChangeBeatsPerBar(_this._doc, SongDurationPrompt._validate(_this._beatsStepper)));
                group.append(new beepbox.ChangeBarCount(_this._doc, SongDurationPrompt._validate(_this._barsStepper)));
                group.append(new beepbox.ChangePatternsPerChannel(_this._doc, SongDurationPrompt._validate(_this._patternsStepper)));
                group.append(new beepbox.ChangeInstrumentsPerChannel(_this._doc, SongDurationPrompt._validate(_this._instrumentsStepper)));
                group.append(new beepbox.ChangeChannelCount(_this._doc, SongDurationPrompt._validate(_this._pitchChannelStepper), SongDurationPrompt._validate(_this._drumChannelStepper)));
                group.append(new beepbox.ChangeVolBend(_this._doc, SongDurationPrompt._validate(_this._volBendStepper)));
                _this._doc.prompt = null;
                _this._doc.record(group, true);
            };
            this._beatsStepper.value = this._doc.song.beatsPerBar + "";
            this._beatsStepper.min = beepbox.Config.beatsPerBarMin + "";
            this._beatsStepper.max = beepbox.Config.beatsPerBarMax + "";
            this._barsStepper.value = this._doc.song.barCount + "";
            this._barsStepper.min = beepbox.Config.barCountMin + "";
            this._barsStepper.max = beepbox.Config.barCountMax + "";
            this._patternsStepper.value = this._doc.song.patternsPerChannel + "";
            this._patternsStepper.min = beepbox.Config.patternsPerChannelMin + "";
            this._patternsStepper.max = beepbox.Config.patternsPerChannelMax + "";
            this._instrumentsStepper.value = this._doc.song.instrumentsPerChannel + "";
            this._instrumentsStepper.min = beepbox.Config.instrumentsPerChannelMin + "";
            this._instrumentsStepper.max = beepbox.Config.instrumentsPerChannelMax + "";
            this._pitchChannelStepper.value = this._doc.song.pitchChannelCount + "";
            this._pitchChannelStepper.min = beepbox.Config.pitchChannelCountMin + "";
            this._pitchChannelStepper.max = beepbox.Config.pitchChannelCountMax + "";
            this._drumChannelStepper.value = this._doc.song.drumChannelCount + "";
            this._drumChannelStepper.min = beepbox.Config.drumChannelCountMin + "";
            this._drumChannelStepper.max = beepbox.Config.drumChannelCountMax + "";
            this._volBendStepper.value = this._doc.song.volBendCount + "";
            this._volBendStepper.min = beepbox.Config.volBendMin + "";
            this._volBendStepper.max = beepbox.Config.volBendMax + "";
            this._okayButton.addEventListener("click", this._saveChanges);
            this._cancelButton.addEventListener("click", this._close);
            this._beatsStepper.addEventListener("keypress", SongDurationPrompt._validateKey);
            this._barsStepper.addEventListener("keypress", SongDurationPrompt._validateKey);
            this._patternsStepper.addEventListener("keypress", SongDurationPrompt._validateKey);
            this._instrumentsStepper.addEventListener("keypress", SongDurationPrompt._validateKey);
            this._pitchChannelStepper.addEventListener("keypress", SongDurationPrompt._validateKey);
            this._drumChannelStepper.addEventListener("keypress", SongDurationPrompt._validateKey);
            this._volBendStepper.addEventListener("keypress", SongDurationPrompt._validateKey);
            this._beatsStepper.addEventListener("blur", SongDurationPrompt._validateNumber);
            this._barsStepper.addEventListener("blur", SongDurationPrompt._validateNumber);
            this._patternsStepper.addEventListener("blur", SongDurationPrompt._validateNumber);
            this._instrumentsStepper.addEventListener("blur", SongDurationPrompt._validateNumber);
            this._pitchChannelStepper.addEventListener("blur", SongDurationPrompt._validateNumber);
            this._drumChannelStepper.addEventListener("blur", SongDurationPrompt._validateNumber);
            this._volBendStepper.addEventListener("blur", SongDurationPrompt._validateNumber);
        }
        SongDurationPrompt._validateKey = function (event) {
            var charCode = (event.which) ? event.which : event.keyCode;
            if (charCode != 46 && charCode > 31 && (charCode < 48 || charCode > 57)) {
                event.preventDefault();
                return true;
            }
            return false;
        };
        SongDurationPrompt._validateNumber = function (event) {
            var input = event.target;
            input.value = Math.floor(Math.max(Number(input.min), Math.min(Number(input.max), Number(input.value)))) + "";
        };
        SongDurationPrompt._validate = function (input) {
            return Math.floor(Number(input.value));
        };
        return SongDurationPrompt;
    }());
    beepbox.SongDurationPrompt = SongDurationPrompt;
})(beepbox || (beepbox = {}));
// Prompt: export to wav, midi, or json.
var beepbox;
(function (beepbox) {
    var button = beepbox.html.button, div = beepbox.html.div, input = beepbox.html.input, text = beepbox.html.text;
    function lerp(low, high, t) {
        return low + t * (high - low);
    }
    function save(blob, name) {
        if (navigator.msSaveOrOpenBlob) {
            navigator.msSaveOrOpenBlob(blob, name);
            return;
        }
        var anchor = document.createElement("a");
        if (anchor.download != undefined) {
            var url_1 = URL.createObjectURL(blob);
            setTimeout(function () { URL.revokeObjectURL(url_1); }, 60000);
            anchor.href = url_1;
            anchor.download = name;
            setTimeout(function () { anchor.dispatchEvent(new MouseEvent("click")); }, 0);
        }
        else if (navigator.vendor.indexOf("Apple") > -1) {
            var reader = new FileReader();
            reader.onloadend = function () {
                console.log(reader.result);
                var url = reader.result.replace(/^data:[^;]*;/, 'data:attachment/file;');
                if (!window.open(url, "_blank"))
                    window.location.href = url;
            };
            reader.readAsDataURL(blob);
        }
        else {
            var url_2 = URL.createObjectURL(blob);
            setTimeout(function () { URL.revokeObjectURL(url_2); }, 60000);
            if (!window.open(url_2, "_blank"))
                window.location.href = url_2;
        }
    }
    if (!ArrayBuffer.transfer) {
        ArrayBuffer.transfer = function (source, length) {
            var dest = new ArrayBuffer(length);
            if (!(source instanceof ArrayBuffer) || !(dest instanceof ArrayBuffer)) {
                throw new TypeError('Source and destination must be ArrayBuffer instances');
            }
            var nextOffset = 0;
            var leftBytes = Math.min(source.byteLength, dest.byteLength);
            var wordSizes = [8, 4, 2, 1];
            for (var _i = 0, wordSizes_1 = wordSizes; _i < wordSizes_1.length; _i++) {
                var wordSize = wordSizes_1[_i];
                if (leftBytes >= wordSize) {
                    var done = transferWith(wordSize, source, dest, nextOffset, leftBytes);
                    nextOffset = done.nextOffset;
                    leftBytes = done.leftBytes;
                }
            }
            return dest;
            function transferWith(wordSize, source, dest, nextOffset, leftBytes) {
                var ViewClass = Uint8Array;
                switch (wordSize) {
                    case 8:
                        ViewClass = Float64Array;
                        break;
                    case 4:
                        ViewClass = Float32Array;
                        break;
                    case 2:
                        ViewClass = Uint16Array;
                        break;
                    case 1:
                        ViewClass = Uint8Array;
                        break;
                    default:
                        ViewClass = Uint8Array;
                        break;
                }
                var view_source = new ViewClass(source, nextOffset, (leftBytes / wordSize) | 0);
                var view_dest = new ViewClass(dest, nextOffset, (leftBytes / wordSize) | 0);
                for (var i = 0; i < view_dest.length; i++) {
                    view_dest[i] = view_source[i];
                }
                return {
                    nextOffset: view_source.byteOffset + view_source.byteLength,
                    leftBytes: leftBytes - view_dest.length * wordSize,
                };
            }
        };
    }
    var ExportPrompt = (function () {
        function ExportPrompt(_doc, _songEditor) {
            var _this = this;
            this._doc = _doc;
            this._songEditor = _songEditor;
            this._fileName = input({ type: "text", style: "width: 10em;", value: ("Modbox-Song"), maxlength: 250 });
            this._enableIntro = input({ type: "checkbox" });
            this._loopDropDown = input({ style: "width: 2em;", type: "number", min: "1", max: "4", step: "1" });
            this._enableOutro = input({ type: "checkbox" });
            this._exportWavButton = button({}, [text("Export to .wav file")]);
            this._exportMidiButton = button({}, [text("Export to .midi file")]);
            this._exportJsonButton = button({}, [text("Export to .json file")]);
            this._cancelButton = button({}, [text("Cancel")]);
            this.container = div({ className: "prompt", style: "width: 200px;" }, [
                div({ style: "font-size: 2em" }, [text("Export Options")]),
                div({ style: "display: flex; flex-direction: row; align-items: center; justify-content: space-between;" }, [
                    text("File name:"),
                    this._fileName,
                ]),
                div({ style: "display: table; width: 100%;" }, [
                    div({ style: "display: table-row;" }, [
                        div({ style: "display: table-cell;" }, [text("Intro:")]),
                        div({ style: "display: table-cell;" }, [text("Loop Count:")]),
                        div({ style: "display: table-cell;" }, [text("Outro:")]),
                    ]),
                    div({ style: "display: table-row;" }, [
                        div({ style: "display: table-cell; vertical-align: middle;" }, [this._enableIntro]),
                        div({ style: "display: table-cell; vertical-align: middle;" }, [this._loopDropDown]),
                        div({ style: "display: table-cell; vertical-align: middle;" }, [this._enableOutro]),
                    ]),
                ]),
                this._exportWavButton,
                this._exportMidiButton,
                this._exportJsonButton,
                this._cancelButton,
            ]);
            this._close = function () {
                _this._doc.undo();
            };
            this.cleanUp = function () {
                _this._fileName.removeEventListener("input", ExportPrompt._validateFileName);
                _this._loopDropDown.removeEventListener("blur", ExportPrompt._validateNumber);
                _this._exportWavButton.removeEventListener("click", _this._whenExportToWav);
                _this._exportMidiButton.removeEventListener("click", _this._whenExportToMidi);
                _this._exportJsonButton.removeEventListener("click", _this._whenExportToJson);
                _this._cancelButton.removeEventListener("click", _this._close);
            };
            this._whenExportToWav = function () {
                var synth = new beepbox.Synth(_this._doc.song);
                synth.enableIntro = _this._enableIntro.checked;
                synth.enableOutro = _this._enableOutro.checked;
                synth.loopCount = Number(_this._loopDropDown.value);
                if (!synth.enableIntro) {
                    for (var introIter = 0; introIter < _this._doc.song.loopStart; introIter++) {
                        synth.nextBar();
                    }
                }
                var sr = _this._doc.song.sampleRate;
                var deviceRate;
                var liveCtx = _this._doc.synth.audioCtx;
                if (liveCtx) {
                    deviceRate = liveCtx.sampleRate;
                } else {
                    var CtxClass = (window.AudioContext || window.webkitAudioContext || window.mozAudioContext || window.oAudioContext || window.msAudioContext);
                    var tmpCtx = new CtxClass();
                    deviceRate = tmpCtx.sampleRate;
                    if (tmpCtx.close) tmpCtx.close();
                }
                var exportSps;
                if (sr === 0) exportSps = 44100;
                else if (sr === 1) exportSps = 48000;
                else if (sr === 2) exportSps = deviceRate;
                else if (sr === 3) exportSps = deviceRate * 4;
                else if (sr === 4) exportSps = deviceRate * 2;
                else if (sr === 5) exportSps = deviceRate / 2;
                else if (sr === 6) exportSps = deviceRate / 4;
                else if (sr === 7) exportSps = deviceRate / 8;
                else if (sr === 8) exportSps = deviceRate / 16;
                else exportSps = deviceRate;
                synth.samplesPerSecond = exportSps;
                synth.effectAngle = Math.PI * 2.0 / (synth.effectDuration * exportSps);
                synth.effectYMult = 2.0 * Math.cos(synth.effectAngle);
                synth.limitDecay = 1.0 / (2.0 * exportSps);
                var sampleFrames = synth.totalSamples;
				var sampleFramesRight = synth.totalSamples;
                var recordedSamplesLeft = new Float32Array(sampleFrames);
				var recordedSamplesRight = new Float32Array(sampleFramesRight);
                synth.synthesize(recordedSamplesLeft, recordedSamplesRight, sampleFrames);
                var srcChannelCount = 2;
                var wavChannelCount = 2;
                var sampleRate = synth.samplesPerSecond; //mp3 export fix
                var bytesPerSample = 2;
                var bitsPerSample = 8 * bytesPerSample;
                var sampleCount = wavChannelCount * sampleFrames;
                var totalFileSize = 44 + sampleCount * bytesPerSample;
                var index = 0;
                var arrayBuffer = new ArrayBuffer(totalFileSize);
                var data = new DataView(arrayBuffer);
                data.setUint32(index, 0x52494646, false);
                index += 4;
                data.setUint32(index, 36 + sampleCount * bytesPerSample, true);
                index += 4;
                data.setUint32(index, 0x57415645, false);
                index += 4;
                data.setUint32(index, 0x666D7420, false);
                index += 4;
                data.setUint32(index, 0x00000010, true);
                index += 4;
                data.setUint16(index, 0x0001, true);
                index += 2;
                data.setUint16(index, wavChannelCount, true);
                index += 2;
                data.setUint32(index, sampleRate, true);
                index += 4;
                data.setUint32(index, sampleRate * bytesPerSample * wavChannelCount, true);
                index += 4;
                data.setUint16(index, bytesPerSample, true);
                index += 2;
                data.setUint16(index, bitsPerSample, true);
                index += 2;
                data.setUint32(index, 0x64617461, false);
                index += 4;
                data.setUint32(index, sampleCount * bytesPerSample, true);
                index += 4;
                var stride;
                var repeat;
                if (srcChannelCount == wavChannelCount) {
                    stride = 1;
                    repeat = 1;
                }
                else {
                    stride = srcChannelCount;
                    repeat = wavChannelCount;
                }
                var valLeft;
				var valRight;
                if (bytesPerSample > 1) {
                    for (var i = 0; i < sampleFrames; i++) {
                        valLeft = Math.floor(recordedSamplesLeft[i * stride] * ((1 << (bitsPerSample - 1)) - 1));
						valRight = Math.floor(recordedSamplesRight[i * stride] * ((1 << (bitsPerSample - 1)) - 1));
                        for (var k = 0; k < repeat; k++) {
                            if (bytesPerSample == 2) {
                                data.setInt16(index, valLeft, true);
                                index += 2;
								data.setInt16(index, valRight, true);
                                index += 2;
                            }
                            else if (bytesPerSample == 4) {
                                data.setInt32(index, valLeft, true);
                                index += 4;
								data.setInt32(index, valRight, true);
                                index += 4;
                            }
                            else {
                                throw new Error("unsupported sample size");
                            }
                        }
                    }
                }
                else {
                    for (var i = 0; i < sampleFrames; i++) {
                        valLeft = Math.floor(recordedSamplesLeft[i * stride] * 127 + 128);
						valRight = Math.floor(recordedSamplesRight[i * stride] * 127 + 128);
                        for (var k = 0; k < repeat; k++) {
                            data.setUint8(index, valLeft > 255 ? 255 : (valLeft < 0 ? 0 : valLeft));
                            index++;
							data.setUint8(index, valRight > 255 ? 255 : (valRight < 0 ? 0 : valRight));
                            index++;
                        }
                    }
                }
                var blob = new Blob([arrayBuffer], { type: "audio/wav" });
                save(blob, _this._fileName.value.trim() + ".wav");
                _this._close();
            };
            this._whenExportToMidi = function () {
                var writeIndex = 0;
                var fileSize = 0;
                var arrayBuffer = new ArrayBuffer(1024);
                var data = new DataView(arrayBuffer);
                function addBytes(numBytes) {
                    fileSize += numBytes;
                    if (fileSize > arrayBuffer.byteLength) {
                        arrayBuffer = ArrayBuffer.transfer(arrayBuffer, Math.max(arrayBuffer.byteLength * 2, fileSize));
                        data = new DataView(arrayBuffer);
                    }
                }
                function writeUint32(value) {
                    value = value >>> 0;
                    addBytes(4);
                    data.setUint32(writeIndex, value, false);
                    writeIndex = fileSize;
                }
                function writeUint24(value) {
                    value = value >>> 0;
                    addBytes(3);
                    data.setUint8(writeIndex, (value >> 16) & 0xff);
                    data.setUint8(writeIndex + 1, (value >> 8) & 0xff);
                    data.setUint8(writeIndex + 2, (value) & 0xff);
                    writeIndex = fileSize;
                }
                function writeUint16(value) {
                    value = value >>> 0;
                    addBytes(2);
                    data.setUint16(writeIndex, value, false);
                    writeIndex = fileSize;
                }
                function writeUint8(value) {
                    value = value >>> 0;
                    addBytes(1);
                    data.setUint8(writeIndex, value);
                    writeIndex = fileSize;
                }
                function writeFlagAnd7Bits(flag, value) {
                    value = ((value >>> 0) & 0x7f) | ((flag & 0x01) << 7);
                    addBytes(1);
                    data.setUint8(writeIndex, value);
                    writeIndex = fileSize;
                }
                function writeVariableLength(value) {
                    value = value >>> 0;
                    if (value > 0x0fffffff)
                        throw new Error("writeVariableLength value too big.");
                    var startWriting = false;
                    for (var i = 0; i < 4; i++) {
                        var shift = 21 - i * 7;
                        var bits = (value >>> shift) & 0x7f;
                        if (bits != 0 || i == 3)
                            startWriting = true;
                        if (startWriting)
                            writeFlagAnd7Bits(i == 3 ? 0 : 1, bits);
                    }
                }
                function writeAscii(string) {
                    writeVariableLength(string.length);
                    for (var i = 0; i < string.length; i++) {
                        var charCode = string.charCodeAt(i);
                        if (charCode > 0x7f)
                            throw new Error("Trying to write unicode character as ascii."); //houston, we hath problemo
                        writeUint8(charCode);
                    }
                }
                var song = _this._doc.song;
                var ticksPerBeat = 96;
                var ticksPerPart = ticksPerBeat / song.partsPerBeat;
                var ticksPerArpeggio = ticksPerPart / 4;
                var secondsPerMinute = 60;
                var microsecondsPerMinute = secondsPerMinute * 1000000;
                var beatsPerMinute = song.getBeatsPerMinute();
                var microsecondsPerBeat = Math.round(microsecondsPerMinute / beatsPerMinute);
                var secondsPerTick = secondsPerMinute / (ticksPerBeat * beatsPerMinute);
                var ticksPerBar = ticksPerBeat * song.beatsPerBar;
                var unrolledBars = [];
                if (_this._enableIntro.checked) {
                    for (var bar = 0; bar < song.loopStart; bar++) {
                        unrolledBars.push(bar);
                    }
                }
                for (var loopIndex = 0; loopIndex < Number(_this._loopDropDown.value); loopIndex++) {
                    for (var bar = song.loopStart; bar < song.loopStart + song.loopLength; bar++) {
                        unrolledBars.push(bar);
                    }
                }
                if (_this._enableOutro.checked) {
                    for (var bar = song.loopStart + song.loopLength; bar < song.barCount; bar++) {
                        unrolledBars.push(bar);
                    }
                }
                var tracks = [{ isMeta: true, channel: -1, midiChannel: -1, isChorus: false, isDrums: false }];
                var midiChannelCounter = 0;
                for (var channel = 0; channel < _this._doc.song.getChannelCount(); channel++) {
                    if (_this._doc.song.getChannelIsDrum(channel)) {
                        tracks.push({ isMeta: false, channel: channel, midiChannel: midiChannelCounter++, isChorus: false, isDrums: true });
                        if (midiChannelCounter == 9)
                            midiChannelCounter++;
                    }
                    else {
                        tracks.push({ isMeta: false, channel: channel, midiChannel: midiChannelCounter++, isChorus: false, isDrums: false });
                        if (midiChannelCounter == 9)
                            midiChannelCounter++;
                        tracks.push({ isMeta: false, channel: channel, midiChannel: midiChannelCounter++, isChorus: true, isDrums: false });
                        if (midiChannelCounter == 9)
                            midiChannelCounter++;
                    }
                }
                writeUint32(0x4D546864);
                writeUint32(6);
                writeUint16(1);
                writeUint16(tracks.length);
                writeUint16(ticksPerBeat);
                var _loop_1 = function (track) {
                    writeUint32(0x4D54726B);
                    var isMeta = track.isMeta, channel = track.channel, midiChannel = track.midiChannel, isChorus = track.isChorus, isDrums = track.isDrums;
                    var trackLengthIndex = writeIndex;
                    fileSize += 4;
                    writeIndex = fileSize;
                    var prevTime = 0;
                    var barStartTime = 0;
                    var writeEventTime = function (time) {
                        if (time < prevTime)
                            throw new Error("Midi event time cannot go backwards.");
                        writeVariableLength(time - prevTime);
                        prevTime = time;
                    };
                    if (isMeta) {
                        writeEventTime(0);
                        writeUint16(0xFF01);
                        writeAscii("http://www.beepbox.co/#" + song.toBase64String());
                        writeEventTime(0);
                        writeUint24(0xFF5103);
                        writeUint24(microsecondsPerBeat);
                        writeEventTime(0);
                        writeUint24(0xFF5804);
                        writeUint8(song.beatsPerBar);
                        writeUint8(2);
                        writeUint8(24);
                        writeUint8(8);
                        var isMinor = (song.scale < 10) && ((song.scale & 1) == 1);
                        var key = 11 - song.key;
                        var numSharps = key;
                        if ((key & 1) == 1)
                            numSharps += 6;
                        if (isMinor)
                            numSharps += 9;
                        while (numSharps > 6)
                            numSharps -= 12;
                        writeEventTime(0);
                        writeUint24(0xFF5902);
                        writeUint8(numSharps);
                        writeUint8(isMinor ? 1 : 0);
                        if (_this._enableIntro.checked)
                            barStartTime += ticksPerBar * song.loopStart;
                        writeEventTime(barStartTime);
                        writeUint16(0xFF06);
                        writeAscii("Loop Start");
                        for (var loopIndex = 0; loopIndex < Number(_this._loopDropDown.value); loopIndex++) {
                            barStartTime += ticksPerBar * song.loopLength;
                            writeEventTime(barStartTime);
                            writeUint16(0xFF06);
                            writeAscii(loopIndex < Number(_this._loopDropDown.value) - 1 ? "Loop Repeat" : "Loop End");
                        }
                        if (_this._enableOutro.checked)
                            barStartTime += ticksPerBar * (song.barCount - song.loopStart - song.loopLength);
                        if (barStartTime != ticksPerBar * unrolledBars.length)
                            throw new Error("Miscalculated number of bars.");
                    }
                    else {
                        var channelName = song.getChannelIsDrum(channel) ? beepbox.Config.midiDrumChannelNames[channel - song.pitchChannelCount] : beepbox.Config.midiPitchChannelNames[channel];
                        if (isChorus)
                            channelName += " chorus";
                        writeEventTime(0);
                        writeUint16(0xFF03);
                        writeAscii(channelName);
                        writeEventTime(barStartTime);
                        writeUint8(0xB0 | midiChannel);
                        writeFlagAnd7Bits(0, 0x7E);
                        writeFlagAnd7Bits(0, 1);
                        writeEventTime(barStartTime);
                        writeUint8(0xB0 | midiChannel);
                        writeFlagAnd7Bits(0, 0x44);
                        writeFlagAnd7Bits(0, 0x7f);
                        var prevInstrument = -1;
                        var prevPitchBend = -1;
                        var prevExpression = -1;
                        var channelRoot = isDrums ? 33 : beepbox.Config.keyTransposes[song.key];
                        var intervalScale = isDrums ? beepbox.Config.drumInterval : 1;
                        for (var _i = 0, unrolledBars_1 = unrolledBars; _i < unrolledBars_1.length; _i++) {
                            var bar = unrolledBars_1[_i];
                            var pattern = song.getPattern(channel, bar);
                            if (pattern != null) {
                                var nextInstrument = pattern.instrument;
                                var instrument = song.channels[channel].instruments[nextInstrument];
                                if (isDrums || instrument.type == 1 || instrument.chorus == 0) {
                                    barStartTime += ticksPerBar;
                                    continue;
                                }
                                if (prevInstrument != nextInstrument) {
                                    prevInstrument = nextInstrument;
                                    var description = "";
                                    var instrumentProgram = 0x51;
                                    if (isDrums) {
                                        description += "type: " + beepbox.Config.instrumentTypeNames[2];
                                        description += ", noise: " + beepbox.Config.drumNames[instrument.wave];
                                        description += ", volume: " + beepbox.Config.volumeNames[instrument.volume];
                                        description += ", transition: " + beepbox.Config.transitionNames[instrument.transition];
										description += ", harm: " + beepbox.Config.harmNames[instrument.harm];
										description += ", octaveOffset: " + beepbox.Config.octaveOffsetNames[instrument.octaveOffset];
                                        instrumentProgram = 0x7E;
                                    }
                                    else {
                                        description += "type: " + beepbox.Config.instrumentTypeNames[instrument.type];
                                        if (instrument.type == 0) {
                                            description += ", wave: " + beepbox.Config.waveNames[instrument.wave];
                                            description += ", volume: " + beepbox.Config.volumeNames[instrument.volume];
                                            description += ", transition: " + beepbox.Config.transitionNames[instrument.transition];
                                            description += ", filter: " + beepbox.Config.filterNames[instrument.filter];
                                            description += ", chorus: " + beepbox.Config.chorusNames[instrument.chorus];
                                            description += ", effect: " + beepbox.Config.effectNames[instrument.effect];
											description += ", harm: " + beepbox.Config.harmNames[instrument.harm];
											description += ", mute: " + beepbox.Config.muteNames[instrument.muteState];
											description += ", pan: " + beepbox.Config.panValues[instrument.pan];
											description += ", octaveOffset: " + beepbox.Config.octaveOffsetNames[instrument.octaveOffset];
                                            var filterInstruments = beepbox.Config.filterDecays[instrument.filter] == 0 ? beepbox.Config.midiSustainInstruments : beepbox.Config.midiDecayInstruments;
                                            instrumentProgram = filterInstruments[instrument.wave];
                                        }
                                        else if (instrument.type == 1) {
                                            description += ", transition: " + beepbox.Config.transitionNames[instrument.transition];
                                            description += ", effect: " + beepbox.Config.effectNames[instrument.effect];
											description += ", octaveOffset: " + beepbox.Config.octaveOffsetNames[instrument.octaveOffset];
											description += ", fmChorus: " + beepbox.Config.fmChorusNames[instrument.fmChorus];
                                            description += ", algorithm: " + beepbox.Config.midiAlgorithmNames[instrument.algorithm];
                                            description += ", feedbackType: " + beepbox.Config.midiFeedbackNames[instrument.feedbackType];
                                            description += ", feedbackAmplitude: " + instrument.feedbackAmplitude;
                                            description += ", feedbackEnvelope: " + beepbox.Config.operatorEnvelopeNames[instrument.feedbackEnvelope];
											description += ", volume: " + beepbox.Config.volumeNames[instrument.volume];
                                            for (var i = 0; i < beepbox.Config.operatorCount; i++) {
                                                var operator = instrument.operators[i];
                                                description += ", operator" + (i + 1) + ": {";
                                                description += "frequency: " + beepbox.Config.midiFrequencyNames[operator.frequency];
                                                description += ", amplitude: " + operator.amplitude;
                                                description += ", envelope: " + beepbox.Config.operatorEnvelopeNames[operator.envelope];
                                                description += "}";
                                            }
                                        }
                                        else if (instrument.type == 2) {
                                            description += ", wave: " + beepbox.Config.waveNames[instrument.wave];
                                            description += ", volume: " + beepbox.Config.volumeNames[instrument.volume];
                                            description += ", transition: " + beepbox.Config.transitionNames[instrument.transition];
                                            description += ", filter: " + beepbox.Config.filterNames[instrument.filter];
                                            description += ", chorus: " + beepbox.Config.chorusNames[instrument.chorus];
                                            description += ", effect: " + beepbox.Config.effectNames[instrument.effect];
											description += ", harm: " + beepbox.Config.harmNames[instrument.harm];
											description += ", mute: " + beepbox.Config.muteNames[instrument.muteState];
											description += ", pan: " + beepbox.Config.panValues[instrument.pan];
											description += ", octaveOffset: " + beepbox.Config.octaveOffsetNames[instrument.octaveOffset];
                                            var filterInstruments = beepbox.Config.filterDecays[instrument.filter] == 0 ? beepbox.Config.midiSustainInstruments : beepbox.Config.midiDecayInstruments;
                                            instrumentProgram = filterInstruments[instrument.wave];
                                        }
                                        else {
                                            throw new Error("Unrecognized instrument type.");
                                        }
                                    }
                                    writeEventTime(barStartTime);
                                    writeUint16(0xFF04);
                                    writeAscii(description);
                                    writeEventTime(barStartTime);
                                    writeUint8(0xC0 | midiChannel);
                                    writeFlagAnd7Bits(0, instrumentProgram);
                                    var channelVolume = (5 - instrument.volume) / 5;
                                    if (!isDrums && instrument.type == 1)
                                        channelVolume = 1.0;
                                    writeEventTime(barStartTime);
                                    writeUint8(0xB0 | midiChannel);
                                    writeFlagAnd7Bits(0, 0x07);
                                    writeFlagAnd7Bits(0, Math.round(0x7f * channelVolume));
                                }
                                var effectChoice = instrument.effect;
                                var effectVibrato = beepbox.Config.effectVibratos[effectChoice];
                                var effectTremolo = beepbox.Config.effectTremolos[effectChoice];
                                var effectDuration = 0.14;
                                var chorusOffset = 0.0;
                                var chorusHarmonizes = false;
                                var usesArpeggio = true;
                                if (!isDrums) {
                                    if (instrument.type == 0 || instrument.type == 2) {
                                        chorusOffset = beepbox.Config.chorusIntervals[instrument.chorus];
                                        if (!isChorus) {
                                            chorusOffset *= -1;
										}
                                        chorusOffset += beepbox.Config.chorusOffsets[instrument.chorus];
                                        chorusHarmonizes = beepbox.Config.chorusHarmonizes[instrument.chorus];
                                    }
                                    else if (instrument.type == 1) {
                                        usesArpeggio = false;
                                    }
                                    else {
                                        throw new Error("Unrecognized instrument type.");
                                    }
                                }
                                for (var noteIndex = 0; noteIndex < pattern.notes.length; noteIndex++) {
                                    var note = pattern.notes[noteIndex];
                                    var noteStartTime = barStartTime + note.start * ticksPerPart;
                                    var pinTime = noteStartTime;
                                    var pinVolume = note.pins[0].volume;
                                    var pinInterval = note.pins[0].interval;
                                    var prevPitch = channelRoot + note.pitches[0] * intervalScale;
                                    for (var pinIndex = 1; pinIndex < note.pins.length; pinIndex++) {
                                        var nextPinTime = noteStartTime + note.pins[pinIndex].time * ticksPerPart;
                                        var nextPinVolume = note.pins[pinIndex].volume;
                                        var nextPinInterval = note.pins[pinIndex].interval;
                                        var length_1 = nextPinTime - pinTime;
                                        for (var tick = 0; tick < length_1; tick++) {
                                            var tickTime = pinTime + tick;
                                            var linearVolume = lerp(pinVolume, nextPinVolume, tick / length_1);
                                            var linearInterval = lerp(pinInterval, nextPinInterval, tick / length_1);
                                            var arpeggio = Math.floor(tick / ticksPerArpeggio) % 4;
                                            var nextPitch = note.pitches[0];
                                            if (usesArpeggio) {
                                                if (chorusHarmonizes) {
                                                    if (isChorus) {
                                                        if (note.pitches.length == 2) {
                                                            nextPitch = note.pitches[1];
                                                        }
                                                        else if (note.pitches.length == 3) {
                                                            nextPitch = note.pitches[(arpeggio >> 1) + 1];
                                                        }
                                                        else if (note.pitches.length == 4) {
                                                            nextPitch = note.pitches[(arpeggio == 3 ? 1 : arpeggio) + 1];
                                                        }
                                                    }
                                                }
                                                else {
                                                    if (note.pitches.length == 2) {
                                                        nextPitch = note.pitches[arpeggio >> 1];
                                                    }
                                                    else if (note.pitches.length == 3) {
                                                        nextPitch = note.pitches[arpeggio == 3 ? 1 : arpeggio];
                                                    }
                                                    else if (note.pitches.length == 4) {
                                                        nextPitch = note.pitches[arpeggio];
                                                    }
                                                }
                                            }
                                            var interval = linearInterval * intervalScale + chorusOffset;
                                            var wholeInterval = Math.round(interval);
                                            var fractionalInterval = interval - wholeInterval;
                                            var pitchOffset = fractionalInterval;
                                            var effectCurve = Math.sin(Math.PI * 2.0 * (tickTime - barStartTime) * secondsPerTick / effectDuration);
                                            if (effectChoice != 2 || tickTime - noteStartTime >= 3 * ticksPerPart) {
                                                pitchOffset += effectVibrato * effectCurve;
                                            }
                                            var pitchBend = Math.max(0, Math.min(0x3fff, Math.round(0x2000 + 0x1000 * pitchOffset)));
                                            var volume = linearVolume / 3;
                                            var tremolo = 1.0 + effectTremolo * (effectCurve - 1.0);
                                            var expression = Math.round(0x7f * volume * tremolo);
                                            if (pitchBend != prevPitchBend) {
                                                writeEventTime(tickTime);
                                                writeUint8(0xE0 | midiChannel);
                                                writeFlagAnd7Bits(0, pitchBend & 0x7f);
                                                writeFlagAnd7Bits(0, (pitchBend >> 7) & 0x7f);
                                            }
                                            if (expression != prevExpression) {
                                                writeEventTime(tickTime);
                                                writeUint8(0xB0 | midiChannel);
                                                writeFlagAnd7Bits(0, 0x0B);
                                                writeFlagAnd7Bits(0, expression);
                                            }
                                            nextPitch = channelRoot + nextPitch * intervalScale + wholeInterval;
                                            if (tickTime == noteStartTime) {
                                                writeEventTime(tickTime);
                                                writeUint8(0x90 | midiChannel);
                                                writeFlagAnd7Bits(0, nextPitch);
                                                writeFlagAnd7Bits(0, 0x40);
                                            }
                                            else if (nextPitch != prevPitch) {
                                                writeEventTime(tickTime);
                                                writeUint8(0x90 | midiChannel);
                                                writeFlagAnd7Bits(0, nextPitch);
                                                writeFlagAnd7Bits(0, 0x40);
                                                writeEventTime(tickTime);
                                                writeUint8(0x80 | midiChannel);
                                                writeFlagAnd7Bits(0, prevPitch);
                                                writeFlagAnd7Bits(0, 0x40);
                                            }
                                            prevPitchBend = pitchBend;
                                            prevExpression = expression;
                                            prevPitch = nextPitch;
                                        }
                                        pinTime = nextPinTime;
                                        pinVolume = nextPinVolume;
                                        pinInterval = nextPinInterval;
                                    }
                                    writeEventTime(barStartTime + note.end * ticksPerPart);
                                    writeUint8(0x80 | midiChannel);
                                    writeFlagAnd7Bits(0, prevPitch);
                                    writeFlagAnd7Bits(0, 0x40);
                                }
                            }
                            barStartTime += ticksPerBar;
                        }
                    }
                    writeEventTime(barStartTime);
                    writeUint24(0xFF2F00);
                    data.setUint32(trackLengthIndex, writeIndex - trackLengthIndex - 4, false);
                };
                for (var _i = 0, tracks_1 = tracks; _i < tracks_1.length; _i++) {
                    var track = tracks_1[_i];
                    _loop_1(track);
                }
                arrayBuffer = ArrayBuffer.transfer(arrayBuffer, fileSize);
                var blob = new Blob([arrayBuffer], { type: "audio/mid" });
                save(blob, _this._fileName.value.trim() + ".midi");
                _this._close();
            };
            this._whenExportToJson = function () {
                var jsonObject = _this._doc.song.toJsonObject(_this._enableIntro.checked, Number(_this._loopDropDown.value), _this._enableOutro.checked);
                var jsonString = JSON.stringify(jsonObject, null, '\t');
                var blob = new Blob([jsonString], { type: "application/json" });
                save(blob, _this._fileName.value.trim() + ".json");
                _this._close();
            };
            this._loopDropDown.value = "1";
            if (this._doc.song.loopStart == 0) {
                this._enableIntro.checked = false;
                this._enableIntro.disabled = true;
            }
            else {
                this._enableIntro.checked = true;
                this._enableIntro.disabled = false;
            }
            if (this._doc.song.loopStart + this._doc.song.loopLength == this._doc.song.barCount) {
                this._enableOutro.checked = false;
                this._enableOutro.disabled = true;
            }
            else {
                this._enableOutro.checked = true;
                this._enableOutro.disabled = false;
            }
            this._fileName.addEventListener("input", ExportPrompt._validateFileName);
            this._loopDropDown.addEventListener("blur", ExportPrompt._validateNumber);
            this._exportWavButton.addEventListener("click", this._whenExportToWav);
            this._exportMidiButton.addEventListener("click", this._whenExportToMidi);
            this._exportJsonButton.addEventListener("click", this._whenExportToJson);
            this._cancelButton.addEventListener("click", this._close);
        }
        ExportPrompt._validateFileName = function (event) {
            var input = event.target;
            var deleteChars = /[\+\*\$\?\|\{\}\\\/<>#%!`&'"=:@]/gi;
            if (deleteChars.test(input.value)) {
                var cursorPos = input.selectionStart;
                input.value = input.value.replace(deleteChars, "");
                cursorPos--;
                input.setSelectionRange(cursorPos, cursorPos);
            }
        };
        ExportPrompt._validateNumber = function (event) {
            var input = event.target;
            input.value = Math.floor(Math.max(Number(input.min), Math.min(Number(input.max), Number(input.value)))) + "";
        };
        return ExportPrompt;
    }());
    beepbox.ExportPrompt = ExportPrompt;
})(beepbox || (beepbox = {}));
// Prompt: import song data from json.
var beepbox;
(function (beepbox) {
    var button = beepbox.html.button, div = beepbox.html.div, input = beepbox.html.input, text = beepbox.html.text;
    var ImportPrompt = (function () {
        function ImportPrompt(_doc, _songEditor) {
            var _this = this;
            this._doc = _doc;
            this._songEditor = _songEditor;
            this._fileInput = input({ type: "file", accept: ".json,application/json" });
            this._cancelButton = button({}, [text("Cancel")]);
            this.container = div({ className: "prompt", style: "width: 200px;" }, [
                div({ style: "font-size: 2em" }, [text("Import")]),
                div({ style: "text-align: left;" }, [text("BeepBox songs can be exported and re-imported as .json files. You could also use other means to make .json files for BeepBox as long as they follow the same structure.")]),
                this._fileInput,
                this._cancelButton,
            ]);
            this._close = function () {
                _this._doc.undo();
            };
            this.cleanUp = function () {
                _this._fileInput.removeEventListener("change", _this._whenFileSelected);
                _this._cancelButton.removeEventListener("click", _this._close);
            };
            this._whenFileSelected = function () {
                var file = _this._fileInput.files[0];
                if (!file)
                    return;
                var reader = new FileReader();
                reader.addEventListener("load", function (event) {
                    _this._doc.prompt = null;
                    _this._doc.record(new beepbox.ChangeSong(_this._doc, reader.result), true);
                });
                reader.readAsText(file);
            };
            this._fileInput.addEventListener("change", this._whenFileSelected);
            this._cancelButton.addEventListener("click", this._close);
        }
        return ImportPrompt;
    }());
    beepbox.ImportPrompt = ImportPrompt;
})(beepbox || (beepbox = {}));
// Shared prompt identifiers used by the editor router.
var PromptId = {
    exportSong: "export",
    importSong: "import",
    songDuration: "duration",
    archive: "archive",
    instrumentType: "instrumentType",
    chipWave: "chip",
    mixSettings: "mix",
    harmony: "chorus",
    songData: "songData",
    refreshTheme: "refresh",
    refreshThemeKey: "refreshKey",
};

// Shared refresh action used by refresh-related prompts.
var triggerRefreshNow = null;

// Prompt: refresh after theme-dependent UI changes.
var beepbox;

(function (beepbox) {
    var button = beepbox.html.button, div = beepbox.html.div, input = beepbox.html.input, text = beepbox.html.text;
    var RefreshPrompt = (function () {
        function RefreshPrompt(_doc, _songEditor) {
            var _this = this;
            this._doc = _doc;
            this._songEditor = _songEditor;
            this._refreshButton = button({}, [text("Refresh")]);
            this._cancelButton = button({}, [text("Cancel")]);
            this.container = div({ className: "prompt", style: "width: 200px;" }, [
                div({ style: "font-size: 1em" }, [text("Refresh?")]),
                div(undefined, [text("In order for the theme to change the song must refresh. If you refresh on your own after canceling your theme will not update.")]),
				div(undefined, [text("If you use a browser that does not support automatic refreshing, like Microsoft Edge, you will have to refresh manually.")]),
				div(undefined, [text("Would you like to refresh now?")]),
                this._refreshButton,
				this._cancelButton,
            ]);
            this._close = function () {
                _this._doc.undo();
				_this._doc.undo();
            };
            this.cleanUp = function () {
				_this._cancelButton.removeEventListener("click", _this._close);
				_this._refreshButton.removeEventListener("click", triggerRefreshNow);
            };
            this._cancelButton.addEventListener("click", this._close);
			this._refreshButton.addEventListener("click", triggerRefreshNow);
        }
        return RefreshPrompt;
    }());
    beepbox.RefreshPrompt = RefreshPrompt;
})(beepbox || (beepbox = {}));
// Prompt: refresh specifically for Piano theme key color changes.
var beepbox;

(function (beepbox) {
    var button = beepbox.html.button, div = beepbox.html.div, input = beepbox.html.input, text = beepbox.html.text;
    var RefreshKeyPrompt = (function () {
        function RefreshKeyPrompt(_doc, _songEditor) {
            var _this = this;
            this._doc = _doc;
            this._songEditor = _songEditor;
            this._refreshButton = button({}, [text("Refresh")]);
            this.container = div({ className: "prompt", style: "width: 200px;" }, [
                div({ style: "font-size: 1em" }, [text("Refresh?")]),
                div(undefined, [text("Due to you using the Piano theme, you will need to refresh to display the change in key colors.")]),
				div(undefined, [text("You must refresh to continue.")]),
                this._refreshButton,
            ]);
            this._close = function () {
                _this._doc.undo();
				_this._doc.undo();
            };
            this.cleanUp = function () {
				_this._refreshButton.removeEventListener("click", triggerRefreshNow);
            };
            this._refreshButton.addEventListener("click", triggerRefreshNow);
        }
        return RefreshKeyPrompt;
    }());
    beepbox.RefreshKeyPrompt = RefreshKeyPrompt;
})(beepbox || (beepbox = {}));
// Prompt: mixing mode help text.
var beepbox;

(function (beepbox) {
    var button = beepbox.html.button, div = beepbox.html.div, text = beepbox.html.text;
    var MixPrompt = (function () {
        function MixPrompt(_doc, _songEditor) {
            var _this = this;
            this._doc = _doc;
            this._songEditor = _songEditor;
            this._cancelButton = button({}, [text("Close")]);
            this.container = div({ className: "prompt", style: "width: 300px;" }, [
                div({ style: "font-size: 2em" }, [text("Mixing Styles")]),
                div({ style: "text-align: left; margin: 0.5em 0;" }, [
                    text('Mixing styles are a way how changing how loud or soft different sounds are and can change the way different sounds blend and mix together. Using different mixing styles can drastically change your song.'),
				]),
				div({ style: "text-align: left; margin: 0.5em 0;" }, [
                    text('Type A Mixing is akin to mixing in vanilla Beepbox, Sandbox, and most other beepbox mods. In this mixing type, the drums are about twice as loud as in Type B mixing and the sound is generally a bit sharper and blends together differently.'),
				]),
				div({ style: "text-align: left; margin: 0.5em 0;" }, [
                    text('Type B Mixing is regular Modbox mixing.'),
				]),
				div({ style: "text-align: left; margin: 0.5em 0;" }, [
                    text('Type C Mixing is like Type B, save for a few upgrades. There are more volume options in Type C mixing, certain waves (acoustic bass, lyre, ramp pulse, and piccolo) are a bit quieter, the flatline wave is a bit louder, and blending works slightly differently.'),
                ]),
				div({ style: "text-align: left; margin: 0.5em 0;" }, [
                    text('Type D Mixing includes slightly quieter drums from Type B, but also includes sharper sounds for regular notes in pitch channels.'),
                ]),
                this._cancelButton,
            ]);
            this._close = function () {
                _this._doc.undo();
            };
            this.cleanUp = function () {
                _this._cancelButton.removeEventListener("click", _this._close);
            };
            this._cancelButton.addEventListener("click", this._close);
        }
        return MixPrompt;
    }());
    beepbox.MixPrompt = MixPrompt;
})(beepbox || (beepbox = {}));
// Prompt: FM instrument type help text.
var beepbox;

(function (beepbox) {
    var button = beepbox.html.button, div = beepbox.html.div, text = beepbox.html.text;
    var InstrumentTypePrompt = (function () {
        function InstrumentTypePrompt(_doc, _songEditor) {
            var _this = this;
            this._doc = _doc;
            this._songEditor = _songEditor;
            this._cancelButton = button({}, [text("Close")]);
            this.container = div({ className: "prompt", style: "width: 300px;" }, [
                div({ style: "font-size: 2em" }, [text("FM Synthesis")]),
                div({ style: "text-align: left; margin: 0.5em 0;" }, [
                    text('Popularized by the Sega Genesis and Yamaha keyboards, FM Synthesis is a mysterious but powerful technique for crafting sounds. It may seem confusing, but just play around with the options until you get a feel for it, check out some examples in '),
                    beepbox.html.element("a", { target: "_blank", href: "#6n10s0kbl00e07t5m0a7g07j7i7r1o2T1d2c0A0F1B0V1Q0200Pff00E0411T1d1c0A0F0B0V1Q2800Pf700E0711T1d2c0A0F1B4VaQ0200Pfb00E0911T1d1c2A0F9B3V1Q1000Pfbc0E0191T1d2c0AcF8B5V1Q0259PffffE0000T1d3c1AcF4B5V4Q2600Pff00E0011T1d1c0AbF0B0V1Q2580PfffaE2226T1d1c0A1F0B0V1Q520dPff4dEd41eb4zhmu0p21h5dfxd7ij7XrjfiAjPudUTtUSRsTzudTudJvdUTztTzrpPudUTtUSSYTzudTudJTdUTztTzrvPudUTtUSQ" }, [text("this demo")]),
                    text(", or find some instruments to use in the Beepbox Discord's FM sheet "),
					 beepbox.html.element("a", { target: "_blank", href: "https://docs.google.com/spreadsheets/d/1ddbXnrP7yvv5X4oUur9boi3AxcI-Xxz1XIHIAo-wi0s/edit#gid=230623845" }, [text("right here")]),
					 text(".")
                ]),
                div({ style: "text-align: left; margin: 0.5em 0;" }, [text('This FM instrument uses up to four waves, numbered 1, 2, 3, and 4. ' +
                        'Each wave may have its own frequency, volume, and volume envelope to control its effect over time. ')]),
                div({ style: "text-align: left; margin: 0.5em 0;" }, [text('There are two kinds of waves: "carrier" waves play a tone out loud, but "modulator" waves distort other waves instead. ' +
                        'Wave 1 is always a carrier and plays a tone, but other waves may distort it. ' +
                        'The "Algorithm" setting determines which waves are modulators, and which other waves those modulators distort. ')]),
                div({ style: "text-align: left; margin: 0.5em 0;" }, [text('Modulators distort in one direction (like 1←2), but you can also use "Feedback" to make any wave distort in the opposite direction (1→2), in both directions (1🗘2), or even itself (1⟲). ')]),
                div({ style: "text-align: left; margin: 0.5em 0;" }, [text('You can set the pitch of each wave independently by adding simultaneous notes, one above another. This often sounds harsh or dissonant, but can make cool sound effects! ')]),
                this._cancelButton,
            ]);
            this._close = function () {
                _this._doc.undo();
            };
            this.cleanUp = function () {
                _this._cancelButton.removeEventListener("click", _this._close);
            };
            this._cancelButton.addEventListener("click", this._close);
        }
        return InstrumentTypePrompt;
    }());
    beepbox.InstrumentTypePrompt = InstrumentTypePrompt;
})(beepbox || (beepbox = {}));
// Prompt: chorus/custom harmony help text.
var beepbox;
(function (beepbox) {
    var button = beepbox.html.button, div = beepbox.html.div, text = beepbox.html.text;
    var ChorusPrompt = (function () {
        function ChorusPrompt(_doc, _songEditor) {
            var _this = this;
            this._doc = _doc;
            this._songEditor = _songEditor;
            this._cancelButton = button({}, [text("Close")]);
            this.container = div({ className: "prompt", style: "width: 250px;" }, [
                div({ style: "font-size: 2em" }, [text("Custom Harmony")]),
                div({ style: "text-align: left;" }, [text('BeepBox "chip" instruments play two waves at once, each with their own pitch. ')]),
				div({ style: "text-align: left;" }, [text('By placing two notes one above another it will play two indivdual sounds. ' +
                        'This replaces the "arpeggio/trill" effect, and gives you greater control over your harmony. ')]),
				div({ style: "text-align: left;" }, [text('In older versions of Modbox, union would not allow notes to harmonize properly and needed a special harmonic chorus in order to work. This has been patched in Modbox 3.1.0. ')]),
                this._cancelButton,
            ]);
            this._close = function () {
                _this._doc.undo();
            };
            this.cleanUp = function () {
                _this._cancelButton.removeEventListener("click", _this._close);
            };
            this._cancelButton.addEventListener("click", this._close);
        }
        return ChorusPrompt;
    }());
    beepbox.ChorusPrompt = ChorusPrompt;
})(beepbox || (beepbox = {}));
// Prompt: archive links for old ModBox and Sandbox versions.
var beepbox; 
(function (beepbox) {
    var button = beepbox.html.button, div = beepbox.html.div, text = beepbox.html.text;
    var ArchivePrompt = (function () {
        function ArchivePrompt(_doc, _songEditor) {
            var _this = this;
            this._doc = _doc;
            this._songEditor = _songEditor;
            this._cancelButton = button({}, [text("No thanks!")]);
            this.container = div({ className: "prompt", style: "width: 250px;" }, [
                div({ style: "font-size: 2em" }, [text("Archives")]),
				div({ style: "text-align: center;" }, [text('These are the Archives. Below are previous versions of Modded Beepbox/Sandbox that you are able to play around with, changelog included. Go nuts!')]),
                div({ style: "text-align: center;" }, [
					beepbox.html.element("a", { target: "_blank", href: "mb-archives/1.3.0.htm" }, [text("MB 1.3.0")]), text(" | "),
					beepbox.html.element("a", { target: "_blank", href: "mb-archives/1.6.0.htm" }, [text("MB 1.6.0")]), text(" | "),
					beepbox.html.element("a", { target: "_blank", href: "mb-archives/1.9.1.htm" }, [text("MB 1.9.1")]), text(" | "),
					beepbox.html.element("a", { target: "_blank", href: "mb-archives/2.0.0.htm" }, [text("MB v2.0.0")]), text(" | "),
					beepbox.html.element("a", { target: "_blank", href: "mb-archives/2.3.0.htm" }, [text("MB v2.2.2")]), text(" | "),
					beepbox.html.element("a", { target: "_blank", href: "mb-archives/2.3.html" }, [text("MB v2.3.0")]), text(" | "),
					beepbox.html.element("a", { target: "_blank", href: "mb-archives/3.0.html" }, [text("MB v3.0.3")]), text(" | "),
					beepbox.html.element("a", { target: "_blank", href: "sb-archives/1.2.1.htm" }, [text("SB v1.2.1")]), text(" | "),
					beepbox.html.element("a", { target: "_blank", href: "sb-archives/1.3.0.htm" }, [text("SB v1.3.0")]), text(" | "),
					beepbox.html.element("a", { target: "_blank", href: "sb-archives/1.4.0.htm" }, [text("SB v1.4.0")]), text(" | "),
					beepbox.html.element("a", { target: "_blank", href: "sb-archives/2.0.6.1.htm" }, [text("SB v2.0.6.1")]), text(" | "),
					beepbox.html.element("a", { target: "_blank", href: "sb-archives/2.1.3.htm" }, [text("SB v2.1.3")]), text(" | "),
					beepbox.html.element("a", { target: "_blank", href: "sb-archives/3.0.0.htm" }, [text("SB v3.0.0")]), text(" | "),
					beepbox.html.element("a", { target: "_blank", href: "changelogs/mbchangelog.html" }, [text("Changelog")]),
				]),
                this._cancelButton,
            ]);
            this._close = function () {
                _this._doc.undo();
            };
            this.cleanUp = function () {
                _this._cancelButton.removeEventListener("click", _this._close);
            };
            this._cancelButton.addEventListener("click", this._close);
        }
        return ArchivePrompt;
    }());
    beepbox.ArchivePrompt = ArchivePrompt;
})(beepbox || (beepbox = {}));
// Prompt: chip/noise explanation and demo link.
var beepbox;
(function (beepbox) {
    var button = beepbox.html.button, div = beepbox.html.div, text = beepbox.html.text;
    var ChipPrompt = (function () {
        function ChipPrompt(_doc, _songEditor) {
            var _this = this;
            this._doc = _doc;
            this._songEditor = _songEditor;
            this._cancelButton = button({}, [text("Cancel")]);
            this.container = div({ className: "prompt", style: "width: 250px;" }, [
                div({ style: "font-size: 2em" }, [text("Chip and Noise")]),
                div({ style: "text-align: left;" }, [text('Mostly popularized by early Retro video games, such as Super Mario Bros. or Pokemon, Chip and Noise sound effects are used in the chiptune music of the past and the modern electronic music of today.')]),
                div({ style: "text-align: left;" }, [text('Chip is normally used for the main track, bassline, and melody. Many people who use the original beepbox will be familiar with the Waveforms it uses; Triangle, Square, Pulse Wide, Etc.. ' +
				'Sandbox expands that list way more than needed, each waveform having a unique sound.')]),
                div({ style: "text-align: left;" }, [text('Noise, otherwise called Drums, go hand in hand with Chip, being used for background noise, having a distinct different from chip.')]),
                div({ style: "text-align: left;" }, [text('A rather overcomplecated example of the two in use can be found in '),
				beepbox.html.element("a", { target: "_blank", href: "#6n73z0sbu1kbl1de00tcm0x0y0Hea7g1djvi9r1o3321343000T0w1f0d1c0q0G0M0B0h0v0T0w1f1d1c0q0G0M0B0h0v1T0w1f0d1c0q0G0M0B0h0v0T0w1f0d1c0q0G0M0B0h0v0T0w1f0d1c0q0G0M0B0h0v0T0w1f0d1c0q0G0M0B0h0v0T0w1f0d1c0q0G0M0B0h0v0T0w1f0d1c0q0G0M0B0h0v0T0w1f0d1c0q0G0M0B0h0v0T0w1f0d1c0q0G0M0B0h0v0T1d1c0B0M0AaF6_bV1v0Q0000Pfff9E0001T1d1c0B0M0A5F4_eV4v0Q0002Pff55E0011T1d1c0B0M0AcF8_8V1v0Q0000PffffE1111T1d1c0B0M0AcF8_8V1v0Q0000PffffE1111T1d1c0B0M0AcF8_8V1v0Q0000PffffE1111T1d1c0B0M0AcF8_8V1v0Q0000PffffE1111T1d1c0B0M0AcF8_8V1v0Q0000PffffE1111T1d1c0B0M0AcF8_8V1v0Q0000PffffE1111T1d1c0B0M0AcF8_8V1v0Q0000PffffE1111T1d1c0B0M0AcF8_8V1v0Q0000PffffE1111T0wgf1d1c0q1G0M0B0h0v3T0w1f1d1c0q0G0M0B0h0v0T0w1f1d1c0q0G0M0B0h0v0T0w1f1d1c0q0G0M0B0h0v0T0w1f1d1c0q0G0M0B0h0v0T0w1f1d1c0q0G0M0B0h0v0T0w1f1d1c0q0G0M0B0h0v0T0w1f1d1c0q0G0M0B0h0v0T0w1f1d1c0q0G0M0B0h0v0T0w1f1d1c0q0G0M0B0h0v0T0whf1d1c0q0G0M0B0h0v0T0whfcd1c0q0G0M0B0h0v0T0w1f0d1c0q0G0M0B0h0v0T0w1f1d1c0q0G0M0B0h0v0T0w1f1d1c0q0G0M0B0h0v0T0w1f1d1c0q0G0M0B0h0v0T0w1f1d1c0q0G0M0B0h0v0T0w1f1d1c0q0G0M0B0h0v0T0w1f1d1c0q0G0M0B0h0v0T0w1f1d1c0q0G0M0B0h0v0T0wdf1d1c0q0G0M0B0h0v0T0w1f1d1c0q0G0M0B0h0v0T0w1f1d1c0q0G0M0B0h0v0T0w1f1d1c0q0G0M0B0h0v0T0w1f1d1c0q0G0M0B0h0v0T0w1f1d1c0q0G0M0B0h0v0T0w1f1d1c0q0G0M0B0h0v0T0w1f1d1c0q0G0M0B0h0v0T0w1f1d1c0q0G0M0B0h0v0T0w1f1d1c0q0G0M0B0h0v0T0wef1d1c0q0G0M0B6hev0T0w0f0d1c0q0G0M0B3h0v0T0w1f1d1c0q0G0M0B0h0v0T0w1f1d1c0q0G0M0B0h0v0T0w1f1d1c0q0G0M0B0h0v0T0w1f1d1c0q0G0M0B0h0v0T0w1f1d1c0q0G0M0B0h0v0T0w1f1d1c0q0G0M0B0h0v0T0w1f1d1c0q0G0M0B0h0v0T0w1f1d1c0q0G0M0B0h0v0T1d6c0B0M0A0F0_cV1v0Q0000Pf000E0111T0w1f1d1c0q0G0M0B0h0v0T0w1f1d1c0q0G0M0B0h0v0T0w1f1d1c0q0G0M0B0h0v0T0w1f1d1c0q0G0M0B0h0v0T0w1f1d1c0q0G0M0B0h0v0T0w1f1d1c0q0G0M0B0h0v0T0w1f1d1c0q0G0M0B0h0v0T0w1f1d1c0q0G0M0B0h0v0T0w1f1d1c0q0G0M0B0h0v0T0w5d1v1G0q0B0M0T0w0d1v3G0q0B0M0T0w5d1v1G0q0B0M0T0w5d1v1G0q0B0M0T0w5d1v1G0q0B0M0T0w5d1v1G0q0B0M0T0w5d1v1G0q0B0M0T0w5d1v1G0q0B0M0T0w5d1v1G0q0B0M0T0w5d1v1G0q0B0M0T0w6d1v1G0q0B0M0T0w4d1v0G0q0B0M0T0w6d1v1G0q0B0M0T0w6d1v1G0q0B0M0T0w6d1v1G0q0B0M0T0w6d1v1G0q0B0M0T0w6d1v1G0q0B0M0T0w6d1v1G0q0B0M0T0w6d1v1G0q0B0M0T0w6d1v1G0q0B0M0T0w1d1v0G0q0B0M0T0w0d1v1G0q0B0M0T0w1d1v0G0q0B0M0T0w1d1v0G0q0B0M0T0w1d1v0G0q0B0M0T0w1d1v0G0q0B0M0T0w1d1v0G0q0B0M0T0w1d1v0G0q0B0M0T0w1d1v0G0q0B0M0T0w1d1v0G0q0B0M0b121300000000000000000000000000000008454645461217121700000000000000000000000000000123242325000000062324232700000000000000000000000623242325898a898b898b898b0000001213121412151214121312161215121412151214000000001213121412131217121812180000001213121412131214121312151213121467686769abacabad121312141213121e0000000000000000000000123415670000000089ab8cdefghifjkl0000000000000000000000000000000000000000000000000000001213121512131214000000006abc6789121312141213121d00000000000000000000000000000004560123000000000000000000000000000000000456012704580129a000112222222222222222222222232222222311111114000000002222222222222222500000000011223333333333333333333333343333333611112222000000003333333333333333000250000000123435343634353436343534373435343gf0008889abacabad343534363435343ef000000000p2nn2Vcsy45m5EpcbE47wKID9UCXFx7wcwM70zL_E47xVKWogVlkoNCdMoU6gg00000000000000000000CJQIstrwMMKr7w0xnx0xAguwgu3rKKNzNNxXUa007cfK30VFZlgu4bJP70033u046_MwQY449zt1ejQggwKCPoy8nBxISf1CThSXs0eKP6dFIuNAO000000000000000000ISfh2G239xg80qXj3A5Eagl0F1g2w500V4INYId-xIYd08gVZFzO6wd5550syj65FJWvcxqr5Ixcw00000000000000000001jehy6CyGOCwdZJd43hhg6CGCyFcbgg04QW0XtBd2oS1I3o6127cJFEcoX8uCy-8aq1SmQQgd550WqGqaKd100UwuTpjhNwr0S1wgBOEuCy-8aq2TMRd433QQ5GHFEGKwbySmQQ6cd5dd2CD9A00000000000000019GsqmgmCDPm5cZ6CCgjoZ89fuGI319Jv8udFFHTsgAgUz1i5Mu4j64CFNBzws8kFzP9mQRkxParqugsSh3ppGdkBjCMm0QTkxV0cotyGSDwa231itky6ZnjY_cWwgAQA-l9b3gH2Auzjj8qBi6kwqHgMlaj7F1TWGrd_494e8Mkxs5ijIZ7360000000002CcTQkkkkkkgd5555550peyyyyyyy1EEEEEEE3jhhhhhhhg6wd5550qaaaaaaaagRxw0M8gSkkkkkkk6cqpVhg5cucy1E3Ap0U6yC2wq1MgY0Ap6C4HGFwV6GC2JGL71lRSTOkz8O9x7BkllMd0WNSk1Mfewq0U5A3GAxQk5MWTkkkkkkk9Ip0w000000000000000CdjziMw4Q-MFzxkOcxjjt8SnmmgJZJEkPNp6gFGbxcuTo6SiGH2HIvdMOa2Et-iAqqyUldzScQf4RlQxjscE0000000000000000002FwAsewt0W1zE7gewt0NQ3E7gn3gewa0Zp8W50ougGr7co200000000000000000000000F0siE9k4G2gkM81A0E1g381A0E1g381A0E1g381A0E1g0ug381g2w6g381g2w6g381g2w6g381g2w0sw6g2w50cw6g2w50cw6g1420k2S0k0E05idn8cosw740E1g381A0E1g381A0UwI0000000000000000000000juwv8kN88Q4q0QxkQkugVMmowep8qICwVgsGIAdmjmi6Eejmi6H9Eek7aH93lARA1G3BlAxGOq3B1OGOsyqpFCCgVgsGIAdmjgsEelmjAjjdcV0qwVlp8qICwQOjFCCqp2C041820k0E1A0O0k0E1A0O0k0E1A0O0k0E0781A0E1g381A0E1gw5Dc1jcD93AzPwRQ1FF3i6Cwddd0WgQQ1FF3i6Cwddc2eEdl0qqgQxFEEEEE7i6Cwdd8q2t550rwZtmi6H9EdcBv3gGr6Ip0ub3NtV8qICwQOog0000000000000"}, [text("this demo")]),
                    text('.  (Warning: Includes FM)'),
                ]),
                this._cancelButton,
            ]);
            this._close = function () {
                _this._doc.undo();
            };
            this.cleanUp = function () {
                _this._cancelButton.removeEventListener("click", _this._close);
            };
            this._cancelButton.addEventListener("click", this._close);
        }
        return ChipPrompt;
    }());
    beepbox.ChipPrompt = ChipPrompt;
})(beepbox || (beepbox = {}));
// Prompt: current song metadata summary.
var beepbox;
(function (beepbox) {
    var button = beepbox.html.button, div = beepbox.html.div, text = beepbox.html.text;
    var SongDataPrompt = (function () {
        function SongDataPrompt(_doc, _songEditor) {
            var _this = this;
            this._doc = _doc;
            this._songEditor = _songEditor;
            this._cancelButton = button({}, [text("Close")]);
            this.container = div({ className: "prompt", style: "width: 250px;" }, [
                div({ style: "font-size: 2em" }, [text("Song Data")]),
				div({ style: "text-align: left;" }, [text('You are on update Modbox 3.3.0-B_1.')]),
				div({ style: "text-align: left;" }, [text('Your song is ' + _this._doc.synth.totalSeconds + ' seconds long.')]),
				div({ style: "text-align: left;" }, [text('Your song runs at ' + _this._doc.song.getBeatsPerMinute() + ' beats per minute.')]),
				div({ style: "text-align: left;" }, [text('There are currently ' + _this._doc.song.getChannelUnusedCount() + ' unused channels in your song out of 16.')]),
				div({ style: "text-align: left;" }, [text('Your are using the ' + _this._doc.song.getThemeName() + ' theme.')]),
				div({ style: "text-align: left;" }, [text('Your time signuature is ' + _this._doc.song.getTimeSig())]),
				div({ style: "text-align: left;" }, [text('Your scale is ' + _this._doc.song.getScaleNKey() + '.')]),
                this._cancelButton,
            ]);
            this._close = function () {
                _this._doc.undo();
            };
            this.cleanUp = function () {
                _this._cancelButton.removeEventListener("click", _this._close);
            };
            this._cancelButton.addEventListener("click", this._close);
        }
        return SongDataPrompt;
    }());
    beepbox.SongDataPrompt = SongDataPrompt;
})(beepbox || (beepbox = {}));
// Top-level editor assembly, event wiring, and application bootstrap.
var beepbox;
(function (beepbox) {
    var button = beepbox.html.button, div = beepbox.html.div, span = beepbox.html.span, select = beepbox.html.select, option = beepbox.html.option, input = beepbox.html.input, text = beepbox.html.text;
    var isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|android|ipad|playbook|silk/i.test(navigator.userAgent);
    function buildOptions(menu, items) {
        for (var _i = 0, items_1 = items; _i < items_1.length; _i++) {
            var item = items_1[_i];
            menu.appendChild(option(item, item, false, false));
        }
        return menu;
    }
    function setSelectedIndex(menu, index) {
        if (menu.selectedIndex != index)
            menu.selectedIndex = index;
    }
    var Slider = (function () {
        function Slider(input, _doc, _getChange) {
            var _this = this;
            this.input = input;
            this._doc = _doc;
            this._getChange = _getChange;
            this._change = null;
            this._value = 0;
            this._oldValue = 0;
            this._whenInput = function () {
                var continuingProspectiveChange = _this._doc.lastChangeWas(_this._change);
                if (!continuingProspectiveChange)
                    _this._oldValue = _this._value;
                _this._change = _this._getChange(_this._oldValue, parseInt(_this.input.value));
                _this._doc.setProspectiveChange(_this._change);
            };
            this._whenChange = function () {
                _this._doc.record(_this._change);
                _this._change = null;
            };
            input.addEventListener("input", this._whenInput);
            input.addEventListener("change", this._whenChange);
            this.container = span({ style: "display: flex; flex: 1 1 auto; min-width: 0; overflow: hidden; align-items: center;" }, [this.input]);
        }
        Slider.prototype.updateValue = function (value) {
            this._value = value;
            this.input.value = String(value);
        };
        return Slider;
    }());
    var SongEditor = (function () {
        function SongEditor(_doc) {
            var _this = this;
            this._doc = _doc;
            this.prompt = null;
            this._patternEditor = new beepbox.PatternEditor(this._doc);
            this._trackEditor = new beepbox.TrackEditor(this._doc, this);
            this._loopEditor = new beepbox.LoopEditor(this._doc);
            this._trackContainer = div({ className: "trackContainer" }, [
                this._trackEditor.container,
                this._loopEditor.container,
            ]);
            this._barScrollBar = new beepbox.BarScrollBar(this._doc, this._trackContainer);
            this._octaveScrollBar = new beepbox.OctaveScrollBar(this._doc);
            this._piano = new beepbox.Piano(this._doc);
            this._editorBox = div({}, [
                div({ className: "editorBox", style: "height: 481px; display: flex; flex-direction: row; margin-bottom: 6px;" }, [
                    this._piano.container,
                    this._patternEditor.container,
                    this._octaveScrollBar.container,
                ]),
                this._trackContainer,
                this._barScrollBar.container,
            ]);
            this._playButton = button({ style: "width: 80px;", type: "button" });
            this._prevBarButton = button({ className: "prevBarButton", style: "width:45%; margin: 0px; margin-top: -2px;", type: "button", title: "Prev Bar (left bracket)" });
            this._nextBarButton = button({ className: "nextBarButton", style: "width:45%; margin: 0px; margin-top: -2px;", type: "button", title: "Next Bar (right bracket)" });
            this._volumeSlider = input({ title: "main volume", style: "width: 5em; flex-grow: 1; margin: 0px;", type: "range", min: "0", max: "100", value: "50", step: "1" });
            this._editMenu = select({ style: "width: 100%;" }, [
                option("", ("Edit Menu"), true, true),
                option("undo", "Undo (Z)", false, false),
                option("redo", "Redo (Y)", false, false),
                option("copy", "Copy Pattern (C)", false, false),
                option("paste", "Paste Pattern (V)", false, false),
				option("cut", "Cut Pattern (X)", false, false),
                option("transposeUp", "Shift Notes Up (+)", false, false),
                option("transposeDown", "Shift Notes Down (-)", false, false),
                option("duration", "Custom Song Size (Q)", false, false),
                option("import", "Import JSON", false, false),
				option("cleanS", "Clean Slate", false, false),
            ]);
            this._optionsMenu = select({ style: "width: 100%;" }, [
                option("", ("Preferences Menu"), true, true),
                option("autoPlay", "Auto Play On Load", false, false),
                option("autoFollow", "Auto Follow Track", false, false),
                option("showLetters", "Show Piano", false, false),
                option("showFifth", "Highlight 'Fifth' Notes", false, false),
				option("showMore", "Advanced Color Scheme", false, false),
                option("showChannels", "Show All Channels", false, false),
                option("showScrollBar", "Octave Scroll Bar", false, false),
				option("showVolumeBar", "Show Channel Volume", false, false),
				option("advancedSettings", "Enable Advanced Settings", false, false),
            ]);
			this._newSongButton = button({ type: "button" }, [
                text("New"),
                span({ className: "fullWidthOnly" }, [text(" Song")]),
                beepbox.svgElement("svg", { style: "flex-shrink: 0; position: absolute; left: 0; top: 50%; margin-top: -1em; pointer-events: none;", width: "2em", height: "2em", viewBox: "-5 -21 26 26" }, [
                beepbox.svgElement("path", { d: "M 2 0 L 2 -16 L 10 -16 L 14 -12 L 14 0 z M 3 -1 L 13 -1 L 13 -11 L 9 -11 L 9 -15 L 3 -15 z", fill: "currentColor"}),
                ]),
            ]);
            this._songDataButton = button({ type: "button" }, [
                text("Song Data"),
                beepbox.svgElement("svg", { style: "flex-shrink: 0; position: absolute; left: 0; top: 50%; margin-top: -1em; pointer-events: none;", width: "2em", height: "2em", viewBox: "-5 -21 26 26" }, [
                beepbox.svgElement("path", { d: "M 0 0 L 16 0 L 16 -13 L 10 -13 L 8 -16 L 0 -16 L 0 -13 z", fill: "currentColor"}),
                ]),
            ]);
			this._customizeButton = button({ type: "button" }, [
                span({ className: "center" }, [text("Custom Song Size")]),
				beepbox.svgElement("svg", { style: "flex-shrink: 0; position: absolute; left: 0; top: 50%; margin-top: -1em; pointer-events: none;", width: "2em", height: "2em", viewBox: "-13 -13 26 26" }, [
                beepbox.svgElement("path", {d: "M -8 2 L -2 2 L -2 8 L 2 8 L 2 2 L 8 2 L 8 -2 L 2 -2 L 2 -8 L -2 -8 L -2 -2 L -8 -2 z M 0 2 L -4 -2 L -1 -2 L -1 -8 L 1 -8 L 1 -2 L 4 -2 z M -8 -8 L 8 -8 L 8 -9 L -8 -9 L -8 -8 z", fill: "currentColor"}),
                ]),
            ]);
			this._archiveButton = button({ type: "button" }, [
                span({ className: "center" }, [text("Load Mods...")]),
				beepbox.svgElement("svg", { style: "flex-shrink: 0; position: absolute; left: 0; top: 50%; margin-top: -1em; pointer-events: none;", width: "2em", height: "2em", viewBox: "-13 -13 26 26" }, [
				beepbox.svgElement("path", { d: "M 5.78 -1.6 L 7.93 -0.94 L 7.93 0.94 L 5.78 1.6 L 4.85 3.53 L 5.68 5.61 L 4.21 6.78 L 2.36 5.52 L 0.27 5.99 L -0.85 7.94 L -2.68 7.52 L -2.84 5.28 L -4.52 3.95 L -6.73 4.28 L -7.55 2.59 L -5.9 1.07 L -5.9 -1.07 L -7.55 -2.59 L -6.73 -4.28 L -4.52 -3.95 L -2.84 -5.28 L -2.68 -7.52 L -0.85 -7.94 L 0.27 -5.99 L 2.36 -5.52 L 4.21 -6.78 L 5.68 -5.61 L 4.85 -3.53 M 2.92 0.67 L 2.92 -0.67 L 2.35 -1.87 L 1.3 -2.7 L 0 -3 L -1.3 -2.7 L -2.35 -1.87 L -2.92 -0.67 L -2.92 0.67 L -2.35 1.87 L -1.3 2.7 L -0 3 L 1.3 2.7 L 2.35 1.87 z", fill: "currentColor"}),
                ]),
            ]);
			this._undoButton = button({ style: "width:45%; margin: 0px; margin-top: -2px;", type: "button" }, [text("Undo")]);
			this._redoButton = button({ style: "width:45%; margin: 0px; margin-top: -2px;", type: "button" }, [text("Redo")]);
            this._exportButton = button({ type: "button" }, [
                text("Export"),
                beepbox.svgElement("svg", { style: "flex-shrink: 0; position: absolute; left: 0; top: 50%; margin-top: -1em; pointer-events: none;", width: "2em", height: "2em", viewBox: "-13 -13 26 26" }, [
                beepbox.svgElement("path", { d: "M -8 3 L -8 8 L 8 8 L 8 3 L 6 3 L 6 6 L -6 6 L -6 3 z M 0 2 L -4 -2 L -1 -2 L -1 -8 L 1 -8 L 1 -2 L 4 -2 z", fill: "currentColor"}),
                ]),
            ]);
            this._scaleSelect = buildOptions(select({}), beepbox.Config.scaleNames);
			this._mixSelect = buildOptions(select({}), beepbox.Config.mixDisplayNames);
			this._sampleRateSelect = buildOptions(select({}), beepbox.Config.sampleRateNames);
			this._mixHint = beepbox.html.element("a", { className: "hintButton", style: "color: #8a5cff;" }, [text("?")]);
			this._archiveHint = beepbox.html.element("a", { className: "hintButton" }, [text("?")]);
			this._mixSelectRow = div({ className: "selectRow" }, [this._mixHint, this._mixSelect]);
            this._chipHint = beepbox.html.element("a", { className: "hintButton" }, [text("?")]);
			this._instrumentTypeHint = beepbox.html.element("a", { className: "hintButton" }, [text("?")]);
			this._keySelect = buildOptions(select({}), beepbox.Config.keyNames);
			this._themeSelect = buildOptions(select({}), beepbox.Config.themeNames);
            this._tempoSlider = new Slider(input({ style: "margin: 0; width: 0; flex-grow: 1; min-width: 0; vertical-align: middle; color: #fff; accent-color: #fff;", type: "range", min: "0", max: beepbox.Config.tempoSteps - 1, value: "7", step: "1" }), this._doc, function (oldValue, newValue) { return new beepbox.ChangeTempo(_this._doc, oldValue, newValue); });
			this._tempoStepper = input({ style: "width: 3em; margin-left: 0.4em; vertical-align: middle;", type: "number", step: "1" });
            this._reverbSlider = new Slider(input({ style: "margin: 0px;", type: "range", min: "0", max: beepbox.Config.reverbRange - 1, value: "0", step: "1" }), this._doc, function (oldValue, newValue) { return new beepbox.ChangeReverb(_this._doc, oldValue, newValue); });

            this._blendSlider = new Slider(input({ style: "width: 9em; margin: 0px;", type: "range", min: "0", max: beepbox.Config.blendRange - 1, value: "0", step: "1" }), this._doc, function (oldValue, newValue) { return new beepbox.ChangeBlend(_this._doc, oldValue, newValue); });
            this._riffSlider = new Slider(input({ style: "width: 9em; margin: 0px;", type: "range", min: "0", max: beepbox.Config.riffRange - 1, value: "0", step: "1" }), this._doc, function (oldValue, newValue) { return new beepbox.ChangeRiff(_this._doc, oldValue, newValue); });			
            this._detuneSlider = new Slider(input({ style: "width: 9em; margin: 0px;", type: "range", min: "0", max: beepbox.Config.detuneRange - 1, value: "0", step: "1" }), this._doc, function (oldValue, newValue) { return new beepbox.ChangeDetune(_this._doc, oldValue, newValue); });		
            this._muffSlider = new Slider(input({ style: "width: 9em; margin: 0px;", type: "range", min: "0", max: beepbox.Config.muffRange - 1, value: "0", step: "1" }), this._doc, function (oldValue, newValue) { return new beepbox.ChangeMuff(_this._doc, oldValue, newValue); });		
			
            this._muteButton = button({style: "width: 27px;", type: "button"});
			this._muteButtonCompact = button({style: "width: 27px;", type: "button"});
			this._partSelect = buildOptions(select({}), beepbox.Config.rhythmNames);
			this._instrumentTypeSelect = buildOptions(select({}), beepbox.Config.pitchChannelTypeNames);
            this._instrumentTypeHint = beepbox.html.element("a", { className: "hintButton" }, [text("?")]);
            this._instrumentTypeSelectRow = div({ className: "selectRow" }, [span({}, [text("Type: ")]), this._instrumentTypeHint, div({ className: "selectContainer" }, [this._instrumentTypeSelect])]);
            this._algorithmSelect = buildOptions(select({}), beepbox.Config.operatorAlgorithmNames);
            this._algorithmSelectRow = div({ className: "selectRow" }, [span({}, [text("Algorithm: ")]), div({ className: "selectContainer" }, [this._algorithmSelect])]);
            this._instrumentSelect = select({});
            this._instrumentSelectRow = div({ className: "selectRow", style: "display: none;" }, [span({}, [text("Instrument: ")]), div({ className: "selectContainer" }, [this._instrumentSelect])]);
            this._instrumentVolumeSlider = new Slider(input({ style: "margin: 8px; width: 60px;", type: "range", min: "-9", max: "0", value: "0", step: "1" }), this._doc,  function (oldValue, newValue) { return new beepbox.ChangeVolume(_this._doc, oldValue, -newValue); });
            this._instrumentMVolumeSlider = new Slider(input({ style: "margin: 8px; width: 60px;", type: "range", min: "-5", max: "0", value: "0", step: "1" }), this._doc, function (oldValue, newValue) { return new beepbox.ChangeVolume(_this._doc, oldValue, -newValue); });
            this._instrumentVolumeSliderRow = div({ className: "selectRow" }, [span({}, [text("Volume: ")]), this._instrumentVolumeSlider.input, this._muteButton]);
            this._instrumentMVolumeSliderRow = div({ className: "selectRow" }, [span({}, [text("Volume: ")]), this._instrumentMVolumeSlider.input, this._muteButtonCompact]);
            this._instrumentSettingsLabel = div({ style: "margin: 3px 0; text-align: center;" }, [text("Instrument Settings")]),
			this._advancedInstrumentSettingsLabel = div({ style: "margin: 3px 0; text-align: center;" }, [text("Advanced Instrument Settings")]),
			this._waveSelect = buildOptions(select({}), beepbox.Config.waveNames);
            this._drumSelect = buildOptions(select({}), beepbox.Config.drumNames);
			this._pwmwaveSelect = buildOptions(select({}), beepbox.Config.pwmWaveNames);
			this._waveSelectRow = div({ className: "selectRow" }, [span({}, [text("Wave: ")]), div({ className: "selectContainer" }, [this._waveSelect, this._pwmwaveSelect, this._drumSelect])]);
            this._transitionSelect = buildOptions(select({}), beepbox.Config.transitionNames);
            this._filterSelect = buildOptions(select({}), beepbox.Config.filterNames);
            this._filterSelectRow = div({ className: "selectRow" }, [span({}, [text("Filter: ")]), div({ className: "selectContainer" }, [this._filterSelect])]);
            this._chorusSelect = buildOptions(select({}), beepbox.Config.chorusNames);
            this._chorusHint = beepbox.html.element("a", { className: "hintButton", style: "color: #8a5cff;" }, [text("?")]);
            this._chorusSelectRow = div({ className: "selectRow" }, [span({}, [text("Chorus: ")]), div({ className: "selectContainer" }, [this._chorusSelect])]);
            this._effectSelect = buildOptions(select({}), beepbox.Config.effectNames);
            this._effectSelectRow = div({ className: "selectRow" }, [span({}, [text("Effect: ")]), div({ className: "selectContainer" }, [this._effectSelect])]);
			this._harmSelect = buildOptions(select({}), beepbox.Config.harmonyDisplayNames);
            this._harmSelectRow = div({ className: "selectRow" }, [span({}, [text("Chord: ")]), this._chorusHint, div({ className: "selectContainer" }, [this._harmSelect])]);
			this._octaveOffsetSelect = buildOptions(select({}), beepbox.Config.octaveOffsetNames);
            this._octaveOffsetSelectRow = div({ className: "selectRow" }, [span({}, [text("Octave Offset: ")]), div({ className: "selectContainer" }, [this._octaveOffsetSelect])]);
			this._fmChorusSelect = buildOptions(select({}), beepbox.Config.fmChorusDisplayNames);
            this._fmChorusSelectRow = div({ className: "selectRow" }, [span({}, [text("FM Chorus: ")]), div({ className: "selectContainer" }, [this._fmChorusSelect])]);
            
			this._panSlider = new Slider(input({ style: "margin: 8px; width: 100px;", type: "range", min: "-8", max: "0", value: "0", step: "1" }), this._doc, function (oldValue, newValue) { return new beepbox.ChangePan(_this._doc, oldValue, -newValue); });
            this._panSliderRow = div({ className: "selectRow" }, [span({}, [text("Panning: ")]), span({}, [text("L")]), this._panSlider.input, span({}, [text("R")])]);
            
			this._phaseModGroup = div({ style: "display: flex; flex-direction: column; display: none;" }, []);
            this._feedbackTypeSelect = buildOptions(select({}), beepbox.Config.operatorFeedbackNames);
            this._feedbackRow1 = div({ className: "selectRow" }, [span({}, [text("Feedback: ")]), div({ className: "selectContainer" }, [this._feedbackTypeSelect])]);
            this._feedbackAmplitudeSlider = new Slider(input({ style: "margin: 0px; width: 4em;", type: "range", min: "0", max: beepbox.Config.operatorAmplitudeMax, value: "0", step: "1", title: ("Feedback Amplitude ") }), this._doc, function (oldValue, newValue) { return new beepbox.ChangeFeedbackAmplitude(_this._doc, oldValue, newValue); });
            this._feedbackEnvelopeSelect = buildOptions(select({ style: "width: 100%;", title: ("Feedback Envelope ") }), beepbox.Config.operatorEnvelopeNames);
            this._feedbackRow2 = div({ className: "operatorRow" }, [
                div({ style: "margin-right: .1em; visibility: hidden;" }, [text(1 + ".")]),
                div({ style: "width: 3em; margin-right: .3em;" }),
                this._feedbackAmplitudeSlider.input,
                div({ className: "selectContainer", style: "width: 5em; margin-left: .3em;" }, [this._feedbackEnvelopeSelect]),
            ]);
            this._instrumentSettingsGroup = div({}, [
                this._instrumentSettingsLabel,
				this._instrumentSelectRow,
                this._instrumentTypeSelectRow,
				this._instrumentMVolumeSliderRow,
                this._instrumentVolumeSliderRow,
                this._waveSelectRow,
                div({ className: "selectRow" }, [
                    span({}, [text("Transitions: ")]),
                    div({ className: "selectContainer" }, [this._transitionSelect]),
                ]),
                this._filterSelectRow,
                this._chorusSelectRow,
                this._effectSelectRow,
                this._algorithmSelectRow,
                this._phaseModGroup,
                this._feedbackRow1,
                this._feedbackRow2,
            ]);
			this._advancedInstrumentSettingsGroup = div({}, [
                this._advancedInstrumentSettingsLabel,
				this._panSliderRow,
				this._harmSelectRow,
				this._octaveOffsetSelectRow,
				this._fmChorusSelectRow,
            ]);
            this._promptContainer = div({ className: "promptContainer", style: "display: none;" });
            this.mainLayer = div({ className: "beepboxEditor", tabIndex: "0" }, [
            this._editorBox,
            div({ className: "editor-widget-column" }, [
				div({ style: "text-align: center; color: ; align-items: center;" }, [text("ModBox+")]),
                div({ style: "margin: 5px 0; display: flex; flex-direction: row; align-items: center;" }, [
                    this._playButton,
                    div({ style: "width: 1px; height: 10px;" }),
                    beepbox.svgElement("svg", { width: "2em", height: "2em", viewBox: "0 0 26 26" }, [
                    beepbox.svgElement("path", { d: "M 4 17 L 4 9 L 8 9 L 12 5 L 12 21 L 8 17 z", fill: volumeColorPallet[_this._doc.song.theme] }),
                    beepbox.svgElement("path", { d: "M 15 11 L 16 10 A 7.2 7.2 0 0 1 16 16 L 15 15 A 5.8 5.8 0 0 0 15 12 z", fill: volumeColorPallet[_this._doc.song.theme] }),
                    beepbox.svgElement("path", { d: "M 18 8 L 19 7 A 11.5 11.5 0 0 1 19 19 L 18 18 A 10.1 10.1 0 0 0 18 8 z", fill: volumeColorPallet[_this._doc.song.theme] }),
                    ]),
                    div({ style: "width: 1px; height: 10px;" }),
                    this._volumeSlider,
                ]),
			div({ className: "editor-right-widgets" }, [
                div({ className: "editor-right-menus" }, [
                div({ className: "selectContainer menu" }, [
				this._editMenu,
				beepbox.svgElement("svg", { style: "flex-shrink: 0; position: absolute; left: 0; top: 50%; margin-top: -1em; pointer-events: none;", width: "2em", height: "2em", viewBox: "-5 -21 26 26" }, [
				beepbox.svgElement("path", { d: "M 0 0 L 1 -4 L 4 -1 z M 2 -5 L 10 -13 L 13 -10 L 5 -2 zM 11 -14 L 13 -16 L 14 -16 L 16 -14 L 16 -13 L 14 -11 z", fill: "currentColor"}),
				]),
				]),
				div({ className: "selectContainer menu" }, [
				this._optionsMenu,
				beepbox.svgElement("svg", { style: "flex-shrink: 0; position: absolute; left: 0; top: 50%; margin-top: -1em; pointer-events: none;", width: "2em", height: "2em", viewBox: "-13 -13 26 26" }, [
				beepbox.svgElement("path", { d: "M 5.78 -1.6 L 7.93 -0.94 L 7.93 0.94 L 5.78 1.6 L 4.85 3.53 L 5.68 5.61 L 4.21 6.78 L 2.36 5.52 L 0.27 5.99 L -0.85 7.94 L -2.68 7.52 L -2.84 5.28 L -4.52 3.95 L -6.73 4.28 L -7.55 2.59 L -5.9 1.07 L -5.9 -1.07 L -7.55 -2.59 L -6.73 -4.28 L -4.52 -3.95 L -2.84 -5.28 L -2.68 -7.52 L -0.85 -7.94 L 0.27 -5.99 L 2.36 -5.52 L 4.21 -6.78 L 5.68 -5.61 L 4.85 -3.53 M 2.92 0.67 L 2.92 -0.67 L 2.35 -1.87 L 1.3 -2.7 L 0 -3 L -1.3 -2.7 L -2.35 -1.87 L -2.92 -0.67 L -2.92 0.67 L -2.35 1.87 L -1.3 2.7 L -0 3 L 1.3 2.7 L 2.35 1.87 z", fill: "currentColor"}),
                ]),
				]),
				this._exportButton,
				]),
                div({ className: "editor-settings" }, [
                    div({ className: "editor-song-settings" }, [
                    div({ style: "margin: 3px 0; text-align: center; color: #999;" }, [text("Song Settings")]),
                    div({ className: "selectRow" }, [span({}, [text("Theme: ")]),div({ className: "selectContainer", style: "margin: 3px 0; text-align: center; color: #ccc"  }, [this._themeSelect]),]),
					div({ className: "selectRow" }, [span({}, [text("Scale: ")]),div({ className: "selectContainer", style: "margin: 3px 0; text-align: center; color: #ccc" }, [this._scaleSelect]),]),
                    div({ className: "selectRow" }, [span({}, [text("Key: ")]),div({ className: "selectContainer", style: "margin: 3px 0; text-align: center; color: #ccc"  }, [this._keySelect]),]),
                    div({ className: "selectRow" }, [span({}, [text("Tempo: ")]), span({ style: "display: flex; width: 60%; min-width: 0; align-items: center; overflow: hidden;" }, [this._tempoSlider.container, this._tempoStepper]),]),
                    div({ className: "selectRow" }, [span({}, [text("Reverb: ")]),this._reverbSlider.input,]),
                    div({ className: "selectRow" }, [span({}, [text("Rhythm: ")]),div({ className: "selectContainer", style: "margin: 3px 0; text-align: center; color: #ccc"  }, [this._partSelect]),]),
                    ]),
                    div({ className: "editor-instrument-settings" }, [
                        this._instrumentSettingsGroup,
                    ]),
                    ]),
                ]),
            ]),  
		    this._advancedSidebar = div({ className: "editor-right-widget-column", style: "margin: 0px 5px;"}, [
			div({ className: "editor-widgets" }, [
				div({ style: "text-align: center; color: ;" }, [text("Advanced Settings")]),
                div({ style: "margin: 2px 0; display: flex; flex-direction: row; align-items: center;" }, []),
                div({ className: "editor-menus" }, [
					this._newSongButton,    
					this._customizeButton,
					this._songDataButton,
					div({ style: "margin: 5px 0; display: flex; flex-direction: row; justify-content: space-between;" }, [
                    this._prevBarButton,
					this._undoButton,
					this._redoButton,
					this._nextBarButton,
					]), 
				]),
                div({ className: "editor-right-settings" }, [
                    this._advancedSongSettingsPanel = div({ className: "editor-right-song-settings", style: "margin: 0px 5px;"}, [
					div({ style: "margin: 3px 0; text-align: center;" }, [text("Advanced Song Settings")]),
					div({ className: "selectRow" }, [span({}, [text("Mix: ")]),div({ className: "selectContainer" }, [this._mixSelectRow]),]),
					div({ className: "selectRow" }, [span({}, [text("Sample Rate: ")]),div({ className: "selectContainer" }, [this._sampleRateSelect]),]),
                    div({ className: "selectRow" }, [span({}, [text("Blending: ")]),this._blendSlider.input,]),
                    div({ className: "selectRow" }, [span({}, [text("Riff: ")]),this._riffSlider.input,]),
					div({ className: "selectRow" }, [span({}, [text("Detune: ")]),this._detuneSlider.input,]),
					div({ className: "selectRow" }, [span({}, [text("Muff: ")]),this._muffSlider.input,]),
                ]),
                div({ className: "editor-right-instrument-settings" }, [
                    this._advancedInstrumentSettingsGroup,
                ]),
                ]),
                ]),
            ]),  
            this._promptContainer,
            ]);
            this._advancedSongSettings = this._advancedSongSettingsPanel;
            this._changeTranspose = null;
            this._operatorRows = [];
            this._operatorAmplitudeSliders = [];
            this._operatorEnvelopeSelects = [];
            this._operatorFrequencySelects = [];
            this._refocusStage = function () {
                _this.mainLayer.focus();
            };
            this._syncMuteButtons = function (muteState) {
                setSelectedIndex(_this._muteButton, muteState);
                setSelectedIndex(_this._muteButtonCompact, muteState);
            };
            this._renderMuteState = function (isMuted) {
                _this._instrumentSettingsGroup.style.color = isMuted ? "#cccccc" : _this._doc.song.getNoteColorBright(_this._doc.channel);
                _this._advancedInstrumentSettingsGroup.style.color = isMuted ? "#aaaaaa" : _this._doc.song.getNoteColorDim(_this._doc.channel);
                _this._advancedSongSettingsPanel.style.color = "#aaaaaa";
                _this._muteButton.innerText = isMuted ? "◎" : "◉";
                _this._muteButtonCompact.innerText = isMuted ? "◎" : "◉";
            };
            this.whenUpdated = function () {
                var trackBounds = _this._trackContainer.getBoundingClientRect();
                _this._doc.trackVisibleBars = Math.floor((trackBounds.right - trackBounds.left) / 32);
                _this._barScrollBar.render();
                _this._trackEditor.render();
                var optionCommands = [
                    (_this._doc.autoPlay ? "✓ " : "✗ ") + "Auto Play On Load",
                    (_this._doc.autoFollow ? "✓ " : "✗ ") + "Auto Follow Track",
                    (_this._doc.showLetters ? "✓ " : "✗ ") + "Show Piano",
                    (_this._doc.showFifth ? "✓ " : "✗ ") + "Highlight 'Fifth' Notes",
					(_this._doc.showAdvancedColors ? "✓ " : "✗ ") + "Advanced Color Scheme",
                    (_this._doc.showChannels ? "✓ " : "✗ ") + "Show All Channels",
                    (_this._doc.showScrollBar ? "✓ " : "✗ ") + "Octave Scroll Bar",
					(_this._doc.showChannelVolume ? "✓ " : "✗ ") + "Show Channel Volume",
					(_this._doc.showAdvancedSettings ? "✓ " : "✗ ") + "Enable Advanced Settings",
                ];
                for (var i = 0; i < optionCommands.length; i++) {
                    var option_1 = _this._optionsMenu.children[i + 1];
                    if (option_1.innerText != optionCommands[i])
                        option_1.innerText = optionCommands[i];
                }
                var channel = _this._doc.song.channels[_this._doc.channel];
                var pattern = _this._doc.getCurrentPattern();
                var instrumentIndex = _this._doc.getCurrentInstrument();
                var instrument = channel.instruments[instrumentIndex];
                var wasActive = _this.mainLayer.contains(document.activeElement);
                var activeElement = document.activeElement;
				setSelectedIndex(_this._themeSelect, _this._doc.song.theme);
                setSelectedIndex(_this._scaleSelect, _this._doc.song.scale);
				setSelectedIndex(_this._mixSelect, _this._doc.song.mix);
				setSelectedIndex(_this._sampleRateSelect, _this._doc.song.sampleRate);
                setSelectedIndex(_this._keySelect, _this._doc.song.key);
                _this._tempoSlider.updateValue(_this._doc.song.tempo);
                _this._tempoSlider.input.title = _this._doc.song.getBeatsPerMinute() + " beats per minute";
				_this._tempoStepper.value = _this._doc.song.getBeatsPerMinute().toString();
                _this._reverbSlider.updateValue(_this._doc.song.reverb);
				_this._advancedSidebar.style.display = _this._doc.showAdvancedSettings ? "" : "none";
                _this._blendSlider.updateValue(_this._doc.song.blend);
                _this._riffSlider.updateValue(_this._doc.song.riff);
				_this._detuneSlider.updateValue(_this._doc.song.detune);
				_this._muffSlider.updateValue(_this._doc.song.muff);
                setSelectedIndex(_this._partSelect, beepbox.Config.partCounts.indexOf(_this._doc.song.partsPerBeat));
                if (_this._doc.song.getChannelIsDrum(_this._doc.channel)) {
					if (_this._doc.song.mix == 2) {
						_this._instrumentVolumeSliderRow.style.display = "";
						_this._instrumentMVolumeSliderRow.style.display = "none";
					}
					else {
						_this._instrumentVolumeSliderRow.style.display = "none";
						_this._instrumentMVolumeSliderRow.style.display = "";
					}
                    _this._drumSelect.style.display = "";
                    _this._waveSelectRow.style.display = "";
                    _this._instrumentTypeSelectRow.style.display = "none";
                    _this._instrumentTypeSelect.style.display = "none";
                    _this._algorithmSelectRow.style.display = "none";
                    _this._phaseModGroup.style.display = "none";
                    _this._feedbackRow1.style.display = "none";
                    _this._feedbackRow2.style.display = "none";
                    _this._waveSelect.style.display = "none";
					_this._pwmwaveSelect.style.display = "none";
                    _this._filterSelectRow.style.display = "none";
                    _this._chorusSelectRow.style.display = "none";
                    _this._effectSelectRow.style.display = "none";
					_this._panSliderRow.style.display = "";
					_this._harmSelectRow.style.display = "";
					_this._octaveOffsetSelectRow.style.display = "";
					_this._fmChorusSelectRow.style.display = "none";
                }
                else {
                    _this._instrumentTypeSelectRow.style.display = "";
					_this._instrumentTypeSelect.style.display = "";
					if (_this._doc.song.mix == 2) {
						_this._instrumentVolumeSliderRow.style.display = "";
						_this._instrumentMVolumeSliderRow.style.display = "none";
					}
					else {
						_this._instrumentVolumeSliderRow.style.display = "none";
						_this._instrumentMVolumeSliderRow.style.display = "";
					}
					_this._drumSelect.style.display = "none";
					_this._effectSelectRow.style.display = "";
                    if (instrument.type == 0) {
                        _this._waveSelect.style.display = "";
						_this._pwmwaveSelect.style.display = "none";
                        _this._waveSelectRow.style.display = "";
                        _this._filterSelectRow.style.display = "";
                        _this._chorusSelectRow.style.display = "";
						_this._harmSelectRow.style.display = "";
                        _this._algorithmSelectRow.style.display = "none";
                        _this._phaseModGroup.style.display = "none";
                        _this._feedbackRow1.style.display = "none";
                        _this._feedbackRow2.style.display = "none";
						_this._panSliderRow.style.display = "";
						_this._octaveOffsetSelectRow.style.display = "";
						_this._fmChorusSelectRow.style.display = "none";
                    }
                    else if (instrument.type == 1) {
                        _this._algorithmSelectRow.style.display = "";
                        _this._phaseModGroup.style.display = "";
                        _this._feedbackRow1.style.display = "";
                        _this._feedbackRow2.style.display = "";
						_this._harmSelectRow.style.display = "none";
                        _this._waveSelectRow.style.display = "none";
                        _this._filterSelectRow.style.display = "none";
                        _this._chorusSelectRow.style.display = "none";
						_this._panSliderRow.style.display = "";
						_this._octaveOffsetSelectRow.style.display = "";
						_this._fmChorusSelectRow.style.display = "";
                    }
                    else if (instrument.type == 2) {
						_this._waveSelect.style.display = "none";
						_this._pwmwaveSelect.style.display = "";
                        _this._waveSelectRow.style.display = "";
                        _this._filterSelectRow.style.display = "none";
                        _this._chorusSelectRow.style.display = "none";
						_this._harmSelectRow.style.display = "none";
                        _this._algorithmSelectRow.style.display = "none";
                        _this._phaseModGroup.style.display = "none";
                        _this._feedbackRow1.style.display = "none";
                        _this._feedbackRow2.style.display = "none";
						_this._panSliderRow.style.display = "";
						_this._octaveOffsetSelectRow.style.display = "";
						_this._fmChorusSelectRow.style.display = "none";
                    }
                }
                setSelectedIndex(_this._instrumentTypeSelect, instrument.type);
				setSelectedIndex(_this._algorithmSelect, instrument.algorithm);
                _this._instrumentSelectRow.style.display = (_this._doc.song.instrumentsPerChannel > 1) ? "" : "none";
                _this._instrumentSelectRow.style.visibility = (pattern == null) ? "hidden" : "";
                if (_this._instrumentSelect.children.length != _this._doc.song.instrumentsPerChannel) {
                    while (_this._instrumentSelect.firstChild)
                        _this._instrumentSelect.removeChild(_this._instrumentSelect.firstChild);
                    var instrumentList = [];
                    for (var i = 0; i < _this._doc.song.instrumentsPerChannel; i++) {
                        instrumentList.push(i + 1);
                    }
                    buildOptions(_this._instrumentSelect, instrumentList);
                }
				_this._renderMuteState(instrument.muteState == 1);
                setSelectedIndex(_this._waveSelect, instrument.wave);
                setSelectedIndex(_this._drumSelect, instrument.wave);
				setSelectedIndex(_this._pwmwaveSelect, instrument.wave);
                setSelectedIndex(_this._filterSelect, instrument.filter);
                setSelectedIndex(_this._transitionSelect, instrument.transition);
                setSelectedIndex(_this._effectSelect, instrument.effect);
                setSelectedIndex(_this._chorusSelect, instrument.chorus);
				setSelectedIndex(_this._harmSelect, instrument.harm);
				setSelectedIndex(_this._octaveOffsetSelect, instrument.octaveOffset);
				setSelectedIndex(_this._fmChorusSelect, instrument.fmChorus);
				_this._syncMuteButtons(instrument.muteState);
				setSelectedIndex(_this._panSlider, instrument.pan);
				setSelectedIndex(_this._instrumentVolumeSlider, instrument.volume);
				setSelectedIndex(_this._instrumentMVolumeSlider, instrument.volume);
                setSelectedIndex(_this._feedbackTypeSelect, instrument.feedbackType);
                _this._feedbackAmplitudeSlider.updateValue(instrument.feedbackAmplitude);
                setSelectedIndex(_this._feedbackEnvelopeSelect, instrument.feedbackEnvelope);
                _this._feedbackEnvelopeSelect.parentElement.style.color = (instrument.feedbackAmplitude > 0) ? "" : "#999";
                _this._instrumentVolumeSlider.updateValue(-instrument.volume);
				_this._instrumentMVolumeSlider.updateValue(-instrument.volume);
				_this._panSlider.updateValue(-instrument.pan);
                setSelectedIndex(_this._instrumentSelect, instrumentIndex);
				for (var i = 0; i < beepbox.Config.operatorCount; i++) {
                    var isCarrier = (i < beepbox.Config.operatorCarrierCounts[instrument.algorithm]);
                    _this._operatorRows[i].style.color = isCarrier ? "white" : "";
                    setSelectedIndex(_this._operatorFrequencySelects[i], instrument.operators[i].frequency);
                    _this._operatorAmplitudeSliders[i].updateValue(instrument.operators[i].amplitude);
                    setSelectedIndex(_this._operatorEnvelopeSelects[i], instrument.operators[i].envelope);
                    var operatorName = (isCarrier ? ("Voice ") : ("Modulator ")) + (i + 1);
                    _this._operatorFrequencySelects[i].title = operatorName + (" Frequency");
                    _this._operatorAmplitudeSliders[i].input.title = operatorName + (isCarrier ? " Volume" : (" Amplitude"));
                    _this._operatorEnvelopeSelects[i].title = operatorName + (" Envelope");
                    _this._operatorEnvelopeSelects[i].parentElement.style.color = (instrument.operators[i].amplitude > 0) ? "" : "#999";
                }
                _this._piano.container.style.display = _this._doc.showLetters ? "" : "none";
                _this._octaveScrollBar.container.style.display = _this._doc.showScrollBar ? "" : "none";
                _this._barScrollBar.container.style.display = _this._doc.song.barCount > _this._doc.trackVisibleBars ? "" : "none";
                _this._chipHint.style.display = (instrument.type == 1) ? "none" : "";
                _this._instrumentTypeHint.style.display = (instrument.type == 1) ? "" : "none";
				_this._mixHint.style.display = (_this._doc.song.mix != 1) ? "" : "none";
                _this._chorusHint.style.display = (beepbox.Config.harmNames[instrument.harm]) ? "" : "none";
                var patternWidth = 512;
                if (_this._doc.showLetters)
                    patternWidth -= 32;
                if (_this._doc.showScrollBar)
                    patternWidth -= 20;
                _this._patternEditor.container.style.width = String(patternWidth) + "px";
                _this._volumeSlider.value = String(_this._doc.volume);
                if (wasActive && (activeElement.clientWidth == 0)) {
                    _this._refocusStage();
                }
                _this._setPrompt(_this._doc.prompt);
                if (_this._doc.autoFollow && !_this._doc.synth.playing) {
					_this._doc.synth.snapToBar(_this._doc.bar);
                }	
            };
			this._muteInstrument = function () {
				var channel = _this._doc.song.channels[_this._doc.channel];
                var instrument = channel.instruments[_this._doc.getCurrentInstrument()];
				_this._doc.record(new beepbox.ChangeInstrumentMute(_this._doc, _this._muteButton.selectedIndex));
				_this._doc.record(new beepbox.ChangeInstrumentMute(_this._doc, _this._muteButtonCompact.selectedIndex));
                if (instrument.muteState == 1) {
					instrument.muteState = 0;
					_this._syncMuteButtons(instrument.muteState);
                    _this._renderMuteState(false);
					this.whenUpdated();
                }
                else {
					instrument.muteState = 1;
					_this._syncMuteButtons(instrument.muteState);
                    _this._renderMuteState(true);
					this.whenUpdated();
                }
			};
            this._soloSelectedChannel = function () {
                _this._doc.record(new beepbox.ChangeSoloChannel(_this._doc, _this._doc.channel));
            };
            this._whenKeyPressed = function (event) {
                if (_this.prompt) {
                    if (event.keyCode == 27) {
                        window.history.back();
                    }
                    return;
                }
                _this._trackEditor.onKeyPressed(event);
                switch (event.keyCode) {
                    case 77:
                        _this._muteInstrument();
                        event.preventDefault();
                        break;
                    case 83:
                        _this._soloSelectedChannel();
                        event.preventDefault();
                        break;
					case 32:
                        _this._togglePlay();
                        event.preventDefault();
                        break;
                    case 90:
                        if (event.shiftKey) {
                            _this._doc.redo();
                        }
                        else {
                            _this._doc.undo();
                        }
                        event.preventDefault();
                        break;
                    case 89:
                        _this._doc.redo();
                        event.preventDefault();
                        break;
                    case 13:
                        _this._doc.record(new beepbox.ChangeInsertBar(_this._doc, _this._doc.bar));
                        event.preventDefault();
                        break;
                    case 8:
                        _this._doc.record(new beepbox.ChangeDeleteBar(_this._doc, _this._doc.bar));
                        event.preventDefault();
                        break;
                    case 88:
                        _this._cut();
                        event.preventDefault();
                        break;
                    case 67:
                        _this._copy();
                        event.preventDefault();
                        break;
                    case 86:
                        _this._paste();
                        event.preventDefault();
                        break;
                    case 219:
                        _this._doc.synth.prevBar();
                        if (_this._doc.autoFollow) {
                            new beepbox.ChangeChannelBar(_this._doc, _this._doc.channel, Math.floor(_this._doc.synth.playhead));
                        }
                        event.preventDefault();
                        break;
                    case 221:
                        _this._doc.synth.nextBar();
                        if (_this._doc.autoFollow) {
                            new beepbox.ChangeChannelBar(_this._doc, _this._doc.channel, Math.floor(_this._doc.synth.playhead));
                        }
                        event.preventDefault();
                        break;
                    case 189:
                    case 173:
                        _this._transpose(false, event.shiftKey);
                        event.preventDefault();
                        break;
                    case 187:
                    case 61:
                        _this._transpose(true, event.shiftKey);
                        event.preventDefault();
                        break;
					case 81:
                        _this._openPrompt(PromptId.songDuration);
                        event.preventDefault();
                        break;
                }
            };
            this._whenPrevBarPressed = function () {
                _this._doc.synth.prevBar();
            };
            this._whenNextBarPressed = function () {
                _this._doc.synth.nextBar();
            };
            this._togglePlay = function () {
                if (_this._doc.synth.playing) {
                    _this._pause();
                }
                else {
                    _this._play();
                }
            };
            this._setVolumeSlider = function () {
                _this._doc.setVolume(Number(_this._volumeSlider.value));
            };
            this._whenNewSongPressed = function () {
                _this._doc.record(new beepbox.ChangeSong(_this._doc, ""));
                _this._patternEditor.resetCopiedPins();
            };
			this._whenCustomizePressed = function () {
                _this._openPrompt(PromptId.songDuration);
            };
			this._undoFromSidebar = function () {
                _this._doc.undo();
            };
			this._redoFromSidebar = function () {
                _this._doc.redo();
            };
            this._advancedUndo = this._undoFromSidebar;
            this._advancedRedo = this._redoFromSidebar;
            this._openExportPrompt = function () {
                _this._openPrompt(PromptId.exportSong);
            };
            this._openSongDataPrompt = function () {
                _this._openPrompt(PromptId.songData);
            };
            this._openInstrumentTypePrompt = function () {
                _this._openPrompt(PromptId.instrumentType);
            };
            this._openChipPrompt = function () {
                _this._openPrompt(PromptId.chipWave);
            }; 
            this._openMixPrompt = function () {
                _this._openPrompt(PromptId.mixSettings);
            };
            this._openChorusPrompt = function () {
                _this._openPrompt(PromptId.harmony);
            };
            this._openArchivePrompt = function () {
                _this._openPrompt(PromptId.archive);
            };
			triggerRefreshNow = function () {
			_this._doc.undo();
			_this._doc.undo();
			location.reload();
			};
			this._whenSetTheme = function () {
                _this._doc.record(new beepbox.ChangeTheme(_this._doc, _this._themeSelect.selectedIndex));
				_this._openPrompt(PromptId.refreshTheme);
            };
            this._whenSetScale = function () {
                _this._doc.record(new beepbox.ChangeScale(_this._doc, _this._scaleSelect.selectedIndex));
            };
            this._whenSetMix = function () {
                _this._doc.record(new beepbox.ChangeMix(_this._doc, _this._mixSelect.selectedIndex));
            };
            this._whenSetSampleRate = function () {
                _this._doc.record(new beepbox.ChangeSampleRate(_this._doc, _this._sampleRateSelect.selectedIndex));
            };
            this._whenSetKey = function () {
				_this._doc.record(new beepbox.ChangeKey(_this._doc, _this._keySelect.selectedIndex));
				if (_this._doc.song.theme == 19) {
					_this._openPrompt(PromptId.refreshThemeKey);
					}
			};
			this._whenSetTempo = function () {
				var bpm = parseInt(_this._tempoStepper.value) | 0;
				if (!isFinite(bpm))
					return;
				var maxStep = beepbox.Config.tempoSteps - 1;
				var approxStep = Math.round(9.0 * (Math.log(bpm / 120.0) / Math.LN2) + 4.0);
				approxStep = Math.max(0, Math.min(maxStep, approxStep));
				var bestStep = approxStep;
				var bestDiff = Number.POSITIVE_INFINITY;
				for (var step = Math.max(0, approxStep - 2); step <= Math.min(maxStep, approxStep + 2); step++) {
					var stepBpm = Math.round(120.0 * Math.pow(2.0, (-4.0 + step) / 9.0));
					var diff = Math.abs(stepBpm - bpm);
					if (diff < bestDiff) {
						bestDiff = diff;
						bestStep = step;
					}
				}
				_this._doc.record(new beepbox.ChangeTempo(_this._doc, _this._doc.song.tempo, bestStep));
			};
            this._whenSetPartsPerBeat = function () {
                _this._doc.record(new beepbox.ChangePartsPerBeat(_this._doc, beepbox.Config.partCounts[_this._partSelect.selectedIndex]));
            };
            this._whenSetInstrumentType = function () {
                _this._doc.record(new beepbox.ChangeInstrumentType(_this._doc, _this._instrumentTypeSelect.selectedIndex));
            };
            this._whenSetFeedbackType = function () {
                _this._doc.record(new beepbox.ChangeFeedbackType(_this._doc, _this._feedbackTypeSelect.selectedIndex));
            };
            this._whenSetFeedbackEnvelope = function () {
                _this._doc.record(new beepbox.ChangeFeedbackEnvelope(_this._doc, _this._feedbackEnvelopeSelect.selectedIndex));
            };
            this._whenSetAlgorithm = function () {
                _this._doc.record(new beepbox.ChangeAlgorithm(_this._doc, _this._algorithmSelect.selectedIndex));
            };
            this._whenSetInstrument = function () {
                var pattern = _this._doc.getCurrentPattern();
                if (pattern == null)
                    return;
                _this._doc.record(new beepbox.ChangePatternInstrument(_this._doc, _this._instrumentSelect.selectedIndex, pattern));
            };
            this._whenSetWave = function () {
                _this._doc.record(new beepbox.ChangeWave(_this._doc, _this._waveSelect.selectedIndex));
            };
            this._whenSetDrum = function () {
                _this._doc.record(new beepbox.ChangeWave(_this._doc, _this._drumSelect.selectedIndex));
            };
            this._whenSetPWMWave = function () {
                _this._doc.record(new beepbox.ChangeWave(_this._doc, _this._pwmwaveSelect.selectedIndex));
            };
            this._whenSetFilter = function () {
                _this._doc.record(new beepbox.ChangeFilter(_this._doc, _this._filterSelect.selectedIndex));
            };
            this._whenSetTransition = function () {
                _this._doc.record(new beepbox.ChangeTransition(_this._doc, _this._transitionSelect.selectedIndex));
            };
            this._whenSetEffect = function () {
                _this._doc.record(new beepbox.ChangeEffect(_this._doc, _this._effectSelect.selectedIndex));
            };
			this._whenSetHarm = function () {
                _this._doc.record(new beepbox.ChangeHarm(_this._doc, _this._harmSelect.selectedIndex));
            };
			this._whenSetFMChorus = function () {
                _this._doc.record(new beepbox.ChangeFMChorus(_this._doc, _this._fmChorusSelect.selectedIndex));
            };
			this._whenSetOctaveOffset = function () {
                _this._doc.record(new beepbox.ChangeOctaveOffset(_this._doc, _this._octaveOffsetSelect.selectedIndex));
            };
			this._whenSetInstrumentMute = function () {
                _this._doc.record(new beepbox.ChangeInstrumentMute(_this._doc, _this._muteButton.selectedIndex));
				_this._doc.record(new beepbox.ChangeInstrumentMute(_this._doc, _this._muteButtonCompact.selectedIndex));
            };
			this._whenSetChorus = function () {
                _this._doc.record(new beepbox.ChangeChorus(_this._doc, _this._chorusSelect.selectedIndex));
            };
            this._editMenuHandler = function (event) {
                switch (_this._editMenu.value) {
                    case "undo":
                        _this._doc.undo();
                        break;
                    case "redo":
                        _this._doc.redo();
                        break;
                    case "cut":
                        _this._cut();
                        break;
                    case "copy":
                        _this._copy();
                        break;
                    case "paste":
                        _this._paste();
                        break;
                    case "transposeUp":
                        _this._transpose(true, false);
                        break;
                    case "transposeDown":
                        _this._transpose(false, false);
                        break;
                    case "import":
                        _this._openPrompt(PromptId.importSong);
                        break;
		    case "cleanS":
                        _this._whenNewSongPressed();
                        break;
                    case "duration":
                        _this._openPrompt(PromptId.songDuration);
                        break;
                    case "archive":
                        _this._openPrompt(PromptId.archive);
                        break;
                }
                _this._editMenu.selectedIndex = 0;
            };
            this._optionsMenuHandler = function (event) {
                switch (_this._optionsMenu.value) {
                    case "autoPlay":
                        _this._doc.autoPlay = !_this._doc.autoPlay;
                        break;
                    case "autoFollow":
                        _this._doc.autoFollow = !_this._doc.autoFollow;
                        break;
                    case "showLetters":
                        _this._doc.showLetters = !_this._doc.showLetters;
                        break;
                    case "showFifth":
                        _this._doc.showFifth = !_this._doc.showFifth;
                        break;
					case "showMore":
                        _this._doc.showAdvancedColors = !_this._doc.showAdvancedColors;
                        break;
                    case "showChannels":
                        _this._doc.showChannels = !_this._doc.showChannels;
                        break;
                    case "showScrollBar":
                        _this._doc.showScrollBar = !_this._doc.showScrollBar;
                        break;
					case "showVolumeBar":
                        _this._doc.showChannelVolume = !_this._doc.showChannelVolume;
                        break;
                    case "advancedSettings":
                        _this._doc.showAdvancedSettings = !_this._doc.showAdvancedSettings;
                        break;
                }
                _this._optionsMenu.selectedIndex = 0;
                _this._doc.notifier.changed();
                _this._doc.savePreferences();
            };
            this._doc.notifier.watch(this.whenUpdated);
            this._phaseModGroup.appendChild(div({ className: "operatorRow", style: "; height: 1em; margin-top: 0.5em;" }, [
                div({ style: "margin-right: .1em; visibility: hidden;" }, [text(1 + ".")]),
                div({ style: "width: 3em; margin-right: .3em;" }, [text("Freq: ")]),
                div({ style: "width: 4em; margin: 0;" }, [text("Volume:")]),
                div({ style: "width: 5em; margin-left: .3em;" }, [text("Envelope: ")]),
            ]));
            var _loop_2 = function (i) {
                var operatorIndex = i;
                var operatorNumber = div({ style: "margin-right: .1em; color: #999;" }, [text(i + 1 + ".")]);
                var frequencySelect = buildOptions(select({ style: "width: 100%;", title: "Frequency" }), beepbox.Config.operatorFrequencyNames);
                var amplitudeSlider = new Slider(input({ style: "margin: 0; width: 4em;", type: "range", min: "0", max: beepbox.Config.operatorAmplitudeMax, value: "0", step: "1", title: "Volume" }), this_1._doc, function (oldValue, newValue) { return new beepbox.ChangeOperatorAmplitude(_this._doc, operatorIndex, oldValue, newValue); });
                var envelopeSelect = buildOptions(select({ style: "width: 100%;", title: "Envelope" }), beepbox.Config.operatorEnvelopeNames);
                var row = div({ className: "operatorRow" }, [
                    operatorNumber,
                    div({ className: "selectContainer", style: "width: 3em; margin-right: .3em;" }, [frequencySelect]),
                    amplitudeSlider.input,
                    div({ className: "selectContainer", style: "width: 5em; margin-left: .3em;" }, [envelopeSelect]),
                ]);
                this_1._phaseModGroup.appendChild(row);
                this_1._operatorRows[i] = row;
                this_1._operatorAmplitudeSliders[i] = amplitudeSlider;
                this_1._operatorEnvelopeSelects[i] = envelopeSelect;
                this_1._operatorFrequencySelects[i] = frequencySelect;
                envelopeSelect.addEventListener("change", function () {
                    _this._doc.record(new beepbox.ChangeOperatorEnvelope(_this._doc, operatorIndex, envelopeSelect.selectedIndex));
                });
                frequencySelect.addEventListener("change", function () {
                    _this._doc.record(new beepbox.ChangeOperatorFrequency(_this._doc, operatorIndex, frequencySelect.selectedIndex));
                });
            };
            var this_1 = this;
            for (var i = 0; i < beepbox.Config.operatorCount; i++) {
                _loop_2(i);
            }
            this._editMenu.addEventListener("change", this._editMenuHandler);
            this._optionsMenu.addEventListener("change", this._optionsMenuHandler);
			this._themeSelect.addEventListener("change", this._whenSetTheme);
            this._scaleSelect.addEventListener("change", this._whenSetScale);
			this._mixSelect.addEventListener("change", this._whenSetMix);
			this._sampleRateSelect.addEventListener("change", this._whenSetSampleRate);
            this._keySelect.addEventListener("change", this._whenSetKey);
			this._tempoStepper.addEventListener("change", this._whenSetTempo);
			this._tempoStepper.addEventListener("keydown", function (event) { event.stopPropagation(); }, false);
            this._partSelect.addEventListener("change", this._whenSetPartsPerBeat);
            this._instrumentTypeSelect.addEventListener("change", this._whenSetInstrumentType);
			this._algorithmSelect.addEventListener("change", this._whenSetAlgorithm);
            this._instrumentSelect.addEventListener("change", this._whenSetInstrument);
            this._feedbackTypeSelect.addEventListener("change", this._whenSetFeedbackType);
            this._feedbackEnvelopeSelect.addEventListener("change", this._whenSetFeedbackEnvelope);
            this._waveSelect.addEventListener("change", this._whenSetWave);
            this._drumSelect.addEventListener("change", this._whenSetDrum);
			this._pwmwaveSelect.addEventListener("change", this._whenSetPWMWave);
            this._transitionSelect.addEventListener("change", this._whenSetTransition);
            this._filterSelect.addEventListener("change", this._whenSetFilter);
            this._chorusSelect.addEventListener("change", this._whenSetChorus);
            this._effectSelect.addEventListener("change", this._whenSetEffect);
			this._harmSelect.addEventListener("change", this._whenSetHarm);
			this._octaveOffsetSelect.addEventListener("change", this._whenSetOctaveOffset);
			this._fmChorusSelect.addEventListener("change", this._whenSetFMChorus);
			this._muteButton.addEventListener("click", this._muteInstrument);
			this._muteButtonCompact.addEventListener("click", this._muteInstrument);
			this._playButton.addEventListener("click", this._togglePlay);
            this._prevBarButton.addEventListener("click", this._whenPrevBarPressed);
            this._nextBarButton.addEventListener("click", this._whenNextBarPressed);
			this._newSongButton.addEventListener("click", this._whenNewSongPressed);
            this._songDataButton.addEventListener("click", this._openSongDataPrompt);
			this._customizeButton.addEventListener("click", this._whenCustomizePressed);
			this._undoButton.addEventListener("click", this._advancedUndo);
			this._redoButton.addEventListener("click", this._advancedRedo);
            this._exportButton.addEventListener("click", this._openExportPrompt);
			this._archiveButton.addEventListener("click", this._openArchivePrompt);
            this._volumeSlider.addEventListener("input", this._setVolumeSlider);
            this._chipHint.addEventListener("click", this._openChipPrompt);
            this._instrumentTypeHint.addEventListener("click", this._openInstrumentTypePrompt);
			this._mixHint.addEventListener("click", this._openMixPrompt);
            this._chorusHint.addEventListener("click", this._openChorusPrompt);
			this._archiveHint.addEventListener("click", this._openArchivePrompt);
            this._editorBox.addEventListener("mousedown", this._refocusStage);
            this.mainLayer.addEventListener("keydown", this._whenKeyPressed);
            if (isMobile) {
                this._optionsMenu.children[1].disabled = true;
			}
        }
        SongEditor.prototype._openPrompt = function (promptName) {
            this._doc.openPrompt(promptName);
            this._setPrompt(promptName);
        };
        SongEditor.prototype._setPrompt = function (promptName) {
            var normalizedPromptName = promptName == "chipPrompt" ? PromptId.chipWave : promptName;
            if (this.prompt) {
                if (this._wasPlaying)
                    this._play();
                this._wasPlaying = false;
                this._promptContainer.style.display = "none";
                this._promptContainer.removeChild(this.prompt.container);
                this.prompt.cleanUp();
                this.prompt = null;
                this.mainLayer.focus();
            }
            if (normalizedPromptName) {
                switch (normalizedPromptName) {
                    case PromptId.exportSong:
                        this.prompt = new beepbox.ExportPrompt(this._doc, this);
                        break;
                    case PromptId.importSong:
                        this.prompt = new beepbox.ImportPrompt(this._doc, this);
                        break;
                    case PromptId.songDuration:
                        this.prompt = new beepbox.SongDurationPrompt(this._doc, this);
                        break;
                    case PromptId.archive:
                        this.prompt = new beepbox.ArchivePrompt(this._doc, this);
                        break;
                    case PromptId.instrumentType:
                        this.prompt = new beepbox.InstrumentTypePrompt(this._doc, this);
                        break;
                    case PromptId.mixSettings:
                        this.prompt = new beepbox.MixPrompt(this._doc, this);
                        break;
                    case PromptId.harmony:
                        this.prompt = new beepbox.ChorusPrompt(this._doc, this);
                        break;
                    case PromptId.songData:
                        this.prompt = new beepbox.SongDataPrompt(this._doc, this);
                        break;
					case PromptId.refreshTheme:
                        this.prompt = new beepbox.RefreshPrompt(this._doc, this);
                        break;
					case PromptId.refreshThemeKey:
                        this.prompt = new beepbox.RefreshKeyPrompt(this._doc, this);
                        break;
                    case PromptId.chipWave:
                        this.prompt = new beepbox.ChipPrompt(this._doc, this);
                        break;
                    default:
                        throw new Error("Unrecognized prompt type.");
                }
                if (this.prompt) {
                    this._wasPlaying = this._doc.synth.playing;
                    this._pause();
                    this._promptContainer.style.display = null;
                    this._promptContainer.appendChild(this.prompt.container);
                }
            }
        };
        SongEditor.prototype.updatePlayButton = function () {
            if (this._doc.synth.playing) {
                this._playButton.classList.remove("playButton");
                this._playButton.classList.add("pauseButton");
                this._playButton.title = "Pause (Space)";
                this._playButton.innerText = "Pause";
            }
            else {
                this._playButton.classList.remove("pauseButton");
                this._playButton.classList.add("playButton");
                this._playButton.title = "Play (Space)";
                this._playButton.innerText = "Play";
            }
        };
        SongEditor.prototype._play = function (_) {
            this._doc.synth.play();
            this.updatePlayButton();
        };
        SongEditor.prototype._pause = function () {
            this._doc.synth.pause();
            if (this._doc.autoFollow) {
                this._doc.synth.snapToBar(this._doc.bar);
            }
            else {
                this._doc.synth.snapToBar();
            }
            this.updatePlayButton();
        };
        SongEditor.prototype._cut = function () {
            if (this._trackEditor.hasSelection()) {
                this._copy();
                var selection = this._trackEditor.getSelection();
                var group_1 = new beepbox.ChangeGroup();
                for (var channelIndex = selection.channelStart; channelIndex <= selection.channelEnd; channelIndex++) {
                    for (var bar = selection.barStart; bar <= selection.barEnd; bar++) {
                        group_1.append(new beepbox.ChangeBarPattern(this._doc, channelIndex, bar, 0));
                    }
                }
                this._doc.record(group_1);
                return;
            }
            var pattern = this._doc.getCurrentPattern();
            var patternCut = {
                notes: [],
                beatsPerBar: this._doc.song.beatsPerBar,
                partsPerBeat: this._doc.song.partsPerBeat,
                drums: this._doc.song.getChannelIsDrum(this._doc.channel),
            };
            var patternCopy = {
                notes: pattern.notes,
                beatsPerBar: this._doc.song.beatsPerBar,
                partsPerBeat: this._doc.song.partsPerBeat,
                drums: this._doc.song.getChannelIsDrum(this._doc.channel),
            };
			window.localStorage.setItem("patternCopy", JSON.stringify(patternCopy));
            if (patternCut != null && patternCut.drums == this._doc.song.getChannelIsDrum(this._doc.channel)) {
                this._doc.record(new beepbox.ChangePaste(this._doc, pattern, patternCut.notes, patternCut.beatsPerBar, patternCut.partsPerBeat));
            }
        };
        SongEditor.prototype._copy = function () {
            if (this._trackEditor.hasSelection()) {
                var selection = this._trackEditor.getSelection();
                var channelCopies = [];
                for (var channelIndex = selection.channelStart; channelIndex <= selection.channelEnd; channelIndex++) {
                    var copiedBars = [];
                    var copiedPatterns = {};
                    for (var bar = selection.barStart; bar <= selection.barEnd; bar++) {
                        var patternIndex = this._doc.song.channels[channelIndex].bars[bar];
                        copiedBars.push(patternIndex);
                        if (patternIndex > 0 && copiedPatterns[String(patternIndex)] == undefined) {
                            var pattern_1 = this._doc.song.channels[channelIndex].patterns[patternIndex - 1];
                            copiedPatterns[String(patternIndex)] = {
                                notes: beepbox.cloneNoteArray(pattern_1.notes),
                                instrument: pattern_1.instrument,
                            };
                        }
                    }
                    channelCopies.push({
                        isDrum: this._doc.song.getChannelIsDrum(channelIndex),
                        bars: copiedBars,
                        patterns: copiedPatterns,
                    });
                }
                window.localStorage.setItem("trackSelectionCopy", JSON.stringify({ channels: channelCopies }));
                window.localStorage.removeItem("patternCopy");
                return;
            }
            window.localStorage.removeItem("trackSelectionCopy");
            var pattern = this._doc.getCurrentPattern();
            if (pattern == null)
                return;
            var patternCopy = {
                notes: pattern.notes,
                beatsPerBar: this._doc.song.beatsPerBar,
                partsPerBeat: this._doc.song.partsPerBeat,
                drums: this._doc.song.getChannelIsDrum(this._doc.channel),
            };
            window.localStorage.setItem("patternCopy", JSON.stringify(patternCopy));
        };
        SongEditor.prototype._paste = function () {
            var trackSelectionCopy = JSON.parse(String(window.localStorage.getItem("trackSelectionCopy")));
            if (trackSelectionCopy != null) {
                var channelCopies = trackSelectionCopy.channels || [];
                if (channelCopies.length > 0) {
                    var anchor = this._trackEditor.hasSelection() ? this._trackEditor.getSelection() : {
                        barStart: this._doc.bar,
                        barEnd: this._doc.bar,
                        channelStart: this._doc.channel,
                        channelEnd: this._doc.channel,
                    };
                    var group_2 = new beepbox.ChangeGroup();
                    for (var pasteChannel = 0; pasteChannel < channelCopies.length; pasteChannel++) {
                        var channelCopy = channelCopies[pasteChannel];
                        var channelIndex = anchor.channelStart + pasteChannel;
                        if (channelIndex >= this._doc.song.getChannelCount())
                            break;
                        if (!!channelCopy.isDrum != this._doc.song.getChannelIsDrum(channelIndex))
                            continue;
                        var patternCopies = channelCopy.patterns || {};
                        var copiedBars = channelCopy.bars || [];
                        for (var pasteBar = 0; pasteBar < copiedBars.length; pasteBar++) {
                            var bar = anchor.barStart + pasteBar;
                            if (bar >= this._doc.song.barCount)
                                break;
                            var copiedPatternIndex = copiedBars[pasteBar] >>> 0;
                            if (copiedPatternIndex == 0) {
                                group_2.append(new beepbox.ChangeBarPattern(this._doc, channelIndex, bar, 0));
                                continue;
                            }
                            var mappedPatternIndex = copiedPatternIndex;
                            if (mappedPatternIndex > this._doc.song.patternsPerChannel) {
                                group_2.append(new beepbox.ChangePatternsPerChannel(this._doc, mappedPatternIndex));
                            }
                            var targetPattern = this._doc.song.channels[channelIndex].patterns[mappedPatternIndex - 1];
                            var patternCopy_1 = patternCopies[String(copiedPatternIndex)];
                            if (patternCopy_1 != null) {
                                group_2.append(new beepbox.ChangePatternContents(this._doc, targetPattern, patternCopy_1.notes || [], patternCopy_1.instrument || 0));
                            }
                            group_2.append(new beepbox.ChangeBarPattern(this._doc, channelIndex, bar, mappedPatternIndex));
                        }
                    }
                    this._doc.record(group_2);
                    return;
                }
            }
            var pattern = this._doc.getCurrentPattern();
            if (pattern == null)
                return;
            var patternCopy = JSON.parse(String(window.localStorage.getItem("patternCopy")));
            if (patternCopy != null && patternCopy.drums == this._doc.song.getChannelIsDrum(this._doc.channel)) {
                this._doc.record(new beepbox.ChangePaste(this._doc, pattern, patternCopy.notes, patternCopy.beatsPerBar, patternCopy.partsPerBeat));
            }
        };
        SongEditor.prototype._transpose = function (upward, octave) {
            if (octave === void 0) { octave = false; }
            var pattern = this._doc.getCurrentPattern();
            if (pattern == null)
                return;
            var canReplaceLastChange = this._doc.lastChangeWas(this._changeTranspose);
            this._changeTranspose = new beepbox.ChangeTranspose(this._doc, pattern, upward, octave);
            this._doc.record(this._changeTranspose, canReplaceLastChange);
        };
        return SongEditor;
    }());
    beepbox.SongEditor = SongEditor;
    // Boot the reconstructed editor the same way BeepBox 2.3 boots its debug page.
    var doc = new beepbox.SongDocument(location.hash);
    var editor = new SongEditor(doc);
    var beepboxEditorContainer = document.getElementById("beepboxEditorContainer");
    beepboxEditorContainer.appendChild(editor.mainLayer);
    editor.whenUpdated();
    editor.mainLayer.focus();
    if (!isMobile && doc.autoPlay) {
        function autoplay() {
            if (!document.hidden) {
                doc.synth.play();
                editor.updatePlayButton();
                window.removeEventListener("visibilitychange", autoplay);
            }
        }
        if (document.hidden) {
            window.addEventListener("visibilitychange", autoplay);
        }
        else {
            autoplay();
        }
    }
    if ("scrollRestoration" in history)
        history.scrollRestoration = "manual";
    editor.updatePlayButton();
})(beepbox || (beepbox = {}));
