/**
 * This file is part of Wizkers.io
 *
 * The MIT License (MIT)
 *  Copyright (c) 2016 Edouard Lafargue, ed@wizkers.io
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files (the "Software"),
 * to deal in the Software without restriction, including without limitation
 * the rights to use, copy, modify, merge, publish, distribute, sublicense,
 * and/or sell copies of the Software, and to permit persons to whom the Software
 * is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
 * WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR
 * IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

/**
 *  Elecraft Live Display view
 *
 * @author Edouard Lafargue, ed@lafargue.name
 */


define(function (require) {
    "use strict";

    var Snap = require('snap'),
        utils = require('app/utils'),
        template = require('js/tpl/instruments/elecraft/ElecraftLiveView.js');

    // Need to load these, but no related variables.
    require('bootstrap');
    require('bootstrapslider');
    require('jquery_mousewheel');

    // Match macro fields:
    var matchTempl = function (str, args) {
        return str.replace(/<(.*?)>/g, function (match, field) {
            return args[field] || match;
        });
    }

    return (function() {
        console.log("Creating Master KX3 display view");
        // Everything inside of here is private to each instance
        var view; // Reference to the Backbone view, initialize when the view is instanciated

        var bands = ["160m", "80m", "60m", "40m", "30m", "20m", "17m", "15m", "12m", "10m", "6m", 0, 0, 0, 0, 0, "2m"];
        var modes = ["LSB", "USB", "CW", "FM", "AM", "DATA", "CW-REV", 0, "DATA-REV"];
        var vfoangle = 270;
        var vfobangle = 0;
        var dip_x, dip_y, vfodip, oldPageY, vfobwheel;
        var menu_displayed = false;
        var vfob_thr = 0;
        var buttonCodes = {
            // The labels are the IDs of the areas on the KX3 front panel SVG:
            "B_BAND_PLUS": "T08",
            "B_RCL": "H08",
            "B_BAND_MINUS": "T41",
            "B_STORE": "H41",
            "B_FREQ_ENT": "T10",
            "B_SCAN": "H10",
            "B_MSG": "T11",
            "B_REC": "H11",
            "B_ATU_TUNE": "T44",
            "B_ANT": "H44",
            "B_XMIT": "T16",
            "B_TUNE": "H16",
            "B_PRE": "T19",
            "B_NR": "H19",
            "B_ATTN": "T27",
            "B_NB": "H27",
            "B_APF": "T20",
            "B_NTCH": "H20",
            "B_SPOT": "T28",
            "B_CWT": "H28",
            "B_CMP": "T21",
            "B_PITCH": "H21",
            "B_DLY": "T29",
            "B_VOX": "H29",
            "B_MODE": "T14",
            "B_ALT": "H14",
            "B_DATA": "T17",
            "B_TEXT": "H17",
            "B_RIT": "T18",
            "B_PF1": "H18",
            "B_RATE": "T12",
            "B_KHZ": "H12",
            "B_A_SLASH_B": "T24;MD;",
            "B_REV": "H24", // Request mode again when swapping VFO's
            "B_A_TO_B": "T25",
            "B_SPLIT": "H25",
            "B_XIT": "T26",
            "B_PF2": "H26",
            "B_DISP": "T09",
            "B_MENU": "H09;MN;"
        };

        var voltAlertThreshold = 0,
            voltAlertEnabled = false;

        var voltAlertBeep =  new Audio('js/app/instruments/elecraft/600hz.ogg')

        var handleKX3Button = function (e) {
            console.log(e.target.id);
            //$("#kx3 #filter-II").css("visibility", "visible");
            var code = buttonCodes[e.target.id];
            if (code != null) {
                linkManager.sendCommand('SW' + code + ';');
            }
        };

       var rotateVfoWheel = function(deltaY) {
           var d = new Date().getTime();
           // Throttle VFOB action when the menu is displayed,
           // otherwise it is way too fast:
           if (menu_displayed) {
              if ( (d - vfob_thr) < 300)
                return;
           }
           vfob_thr = d;
            vfoangle = (vfoangle- deltaY/2) % 360;
            var tx = dip_x * (Math.cos(vfoangle*2*Math.PI/360));
            var ty = dip_y * (1+Math.sin(vfoangle*2*Math.PI/360));
            vfodip.transform('t' + tx + ',' + ty);
            var step = Math.floor(Math.min(Math.abs(deltaY)/50, 7));
            var cmd = ((deltaY < 0) ? 'UP' : 'DN') + step + ';DS;';
            linkManager.sendCommand(cmd);
        };

       var rotateVfoBWheel = function(deltaY) {
           var d = new Date().getTime();
           // Throttle VFOB action when the menu is displayed,
           // otherwise it is way too fast:
           if (menu_displayed) {
              if ( (d - vfob_thr) < 300)
                return;
              deltaY = 30 * (deltaY/Math.abs(deltaY));
           }
           vfob_thr = d;
           vfobangle = (vfobangle - deltaY/2) % 360;
           vfobwheel.transform('r' + vfobangle );
           var step = Math.floor(Math.min(Math.abs(deltaY)/50, 7));
           var cmd = ((deltaY < 0) ? 'UPB' : 'DNB') + step + ';DB;';
           linkManager.sendCommand(cmd);
        };

        var updateVA = function(e) {
            voltAlertEnabled = view.$('#enable-voltage-alert').is(':checked');
            voltAlertThreshold = parseFloat(view.$('#voltage-alert-level').val());
            view.model.set('device_vmon_threshold', voltAlertThreshold);
            view.model.set('device_vmon_enabled', voltAlertEnabled);
            view.model.save();
        }

        var validateMacros = function () {
            var me = $("#data-mycall");
            var you = $("#data-theircall");
            var ok = true;
            if (me.val() != '') {
                $("#data-mycall-grp").removeClass("has-error");
            } else {
                $("#data-mycall-grp").addClass("has-error");
                ok = false;
            }
            if (you.val() != '') {
                $("#data-theircall-grp").removeClass("has-error");
            } else {
                $("#data-theircall-grp").addClass("has-error");
                ok = false;
            }
            return ok;
        };

        var setIcon = function (name, visible) {
            if (visible) {
                view.$("#kx3 #icon_" + name).show();
            } else {
                view.$("#kx3 #icon_" + name).hide();
            }
        };

        var setModeIcon = function (mode) {
            // We need to update all icons when moving from one mode to another, so
            // I added this helper function
            view.$("#kx3 .mode_icon").hide();
            view.$("#kx3 #icon_" + modes[mode - 1]).show();
        };



    return Backbone.View.extend({

        initialize: function () {
            view = this;
            this.deviceinitdone = false;

            this.textOutputBuffer = [];
            this.transmittingText = false;

            // Keep the value of the previous VFO value to avoid
            // unnecessary redraws of the front panel.
            this.oldVFOA = null;
            this.oldVFOB = null;

            this.slevel = 0;
            this.plevel = 0;
            this.ptt = false;

            // Bad design: this has to be consistent with the settings in settings_wizkers.js
            // (sorry)
            if (this.model.get('radio_data_macros') == undefined) {
                this.model.set('radio_data_macros', {
                    cq: 'CQ CQ DE <MYCALL> <MYCALL>',
                    ans: '<YOURCALL> <YOURCALL> DE <MYCALL> pse kn',
                    qso: '<YOURCALL> DE <MYCALL> ',
                    kn: 'btu <YOURCALL> DE <MYCALL> kn',
                    sk: 'Thank you for this QSO, 73 and all the best! <YOURCALL> de <MYCALL> sk',
                    me: 'Operator: John, QTH: Palo Alto, CA. Grid: CM87wk',
                    brag: 'Rig: Elecraft KX3. Controller: Wizkers.io'
                });
            }
            if (this.model.get('device_vmon_threshold') != undefined &&
                this.model.get('device_vmon_enabled') != undefined ) {
                voltAlertThreshold = parseFloat(this.model.get('device_vmon_threshold'));
                voltAlertEnabled = this.model.get('device_vmon_enabled');
            }

            linkManager.on('status', this.updateStatus, this);
            linkManager.on('input', this.showInput, this);
        },

        ElecraftFrequencyListView: null,

        render: function () {
            var self = this;

            this.$el.html(template());

            var faceplate = Snap("#kx3");
            Snap.load("js/app/instruments/elecraft/KX3.svg", function (f) {
                f.select("#layer1").click(function (e) {
                    handleKX3Button(e);
                });
                faceplate.add(f);
                // Set display constraints for the radio panel:
                faceplate.attr({
                    width: "100%",
                });
                self.$("#kx3 .icon").hide();
                // Initialize the VFO rotating dip element:
                var c = faceplate.select('#vfoa-wheel');;
                var bb = c.getBBox();
                vfodip = faceplate.select('#vfoa-dip');
                vfobwheel = faceplate.select('#vfob-wheel');
                var bb2 = vfodip.getBBox();
                dip_x = (bb.width-(bb2.width+ bb2.y-bb.y))/2;
                dip_y = (bb.height-(bb2.height + bb2.y-bb.y))/2;
            });

            // Initialize our sliding controls:
            $("#rf-control", this.el).slider();
            $("#ag-control", this.el).slider();
            $("#bpf-control", this.el).slider();
            $("#ct-control", this.el).slider();
            $("#mic-control", this.el).slider();


            // Load the frequencies sub view:
            require(['app/instruments/elecraft/frequency_list'], function (view) {
                self.ElecraftFrequencyListView = new view({
                    model: self.model
                });
                if (self.ElecraftFrequencyListView != null) {
                    $('#frequency-selector').html(self.ElecraftFrequencyListView.el);
                    self.ElecraftFrequencyListView.render();
                }
                self.$('#frequency-selector').carousel();
            });

            // And last, load the waterfall sub view:
            require(['app/instruments/elecraft/waterfall'], function (view) {
                self.waterfallView = new view({
                    model: self.model
                });
                if (self.waterfallView != null) {
                    $('#waterfall').html(self.waterfallView.el);
                    self.waterfallView.render();
                }
            });

            this.$('#voltage-alert-level').val(voltAlertThreshold);
            this.$('#enable-voltage-alert').prop('checked',voltAlertEnabled);

            return this;
        },

        onClose: function () {
            linkManager.off('status', this.updatestatus, this);
            linkManager.off('input', this.showInput, this);

            // Note:  the 'onClose' method is called after we changed
            // the driver, so we don't have access to our Elecraft driver
            // anymore: TODO: refactor to first call a "closeDriver" method
            // before changing the instrument ? to be determined...

            // linkManager.driver.stopTextStream();

            if (this.ElecraftFrequencyListView != null)
                this.ElecraftFrequencyListView.onClose();

            console.log("Elecraft live view closing...");
        },

        events: {
            //"click" : "debugClick",
            "change #enable-voltage-alert": "voltAlert",
            "change #voltage-alert-level": "voltAlert",
            "click #power-direct-btn": "setpower",
            "click .store-frequency": "addfrequency",
            "click input#power-direct": "setpower",
            "keypress input#power-direct": "setpower",
            "keypress input#vfoa-direct": "setvfoa",
            "keypress input#vfob-direct": "setvfob",
            "click #vfoa-direct-btn": "setvfoa",
            "click #vfob-direct-btn": "setvfob",
            "click #ct-center": "centerCT",
            "slideStop #ag-control": "setAG",
            "slideStop #mic-control": "setMG",
            "slideStop #rf-control": "setRG",
            "slideStop #bpf-control": "setBW",
            "slideStop #ct-control": "setCT",
            "click .band-btn": "setBand",
            "click .submode-btn": "setSubmode",
            "shown.bs.tab a[data-toggle='tab']": "tabChange",
            "click #data-stream-clear": "clearDataStream",
            "click #data-text-send": "sendText",
            "keypress input#data-text-input": "sendText",
            // Clicks on the macro buttons in text terminal
            "click #data-cq": "sendCQ",
            "click #data-qso": "sendQSO",
            "click #data-sk": "sendSK",
            "click #data-kn": "sendKN",
            "click #data-ans": "sendANS",
            "click #data-me": "sendME",
            "click #data-brag": "sendBRAG",
            "click #mem-left": "hideOverflow",
            "click #mem-right": "hideOverlow",
            "mousewheel #vfoa-wheel": "vfoAWheel",
            "touchmove #vfoa-wheel": "vfoAWheelTouch",
            "touchstart #vfoa-wheel": "vfoAWheelTouchStart",
            "mousewheel #vfob-wheel": "vfoBWheel",
            "touchmove #vfob-wheel": "vfoBWheelTouch",
            "touchstart #vfob-wheel": "vfoBWheelTouchStart"
        },

        vfoAWheel: function(e) {
            // console.log('Mousewheel',e);
            rotateVfoWheel(e.deltaY);
            e.preventDefault(); // Prevent the page from scrolling!
        },

        vfoAWheelTouchStart: function(e) {
            oldPageY = e.originalEvent.touches[0].pageY;
        },

        // Split in two to speed things up
        vfoAWheelTouch: function(e) {
            var ty = e.originalEvent.touches[0].pageY;
            var deltaY = ty - oldPageY;
            oldPageY = ty;
            rotateVfoWheel(deltaY);
            e.preventDefault(); // Prevent the page from scrolling!
        },

        vfoBWheel: function(e) {
            // console.log('Mousewheel',e);
            rotateVfoBWheel(e.deltaY);
            e.preventDefault(); // Prevent the page from scrolling!
        },

        vfoBWheelTouchStart: function(e) {
            oldPageY = e.originalEvent.touches[0].pageY;
        },

        // Split in two to speed things up
        vfoBWheelTouch: function(e) {
            var ty = e.originalEvent.touches[0].pageY;
            var deltaY = ty - oldPageY;
            oldPageY = ty;
            rotateVfoBWheel(deltaY);
            e.preventDefault(); // Prevent the page from scrolling!
        },

        hideOverflow: function () {
            // $("#xtrafunc-leftside").css('overflow', 'hidden');

        },

        voltAlert: function(e) {
            updateVA(e);
        },

        debugClick: function (e) {
            console.log(e);
            return true;
        },

        queueText: function (txt) {
            var chunks = txt.match(/.{1,20}/g); // Nice, eh ?
            chunks.forEach(function (chunk) {
                this.textOutputBuffer.push(chunk)
            }, this);
        },

        tabChange: function (e) {
            console.log("Change tab to: " + e.target);
            if (e.target.text == "Data") {
                linkManager.driver.startTextStream();
            } else {
                linkManager.driver.stopTextStream();
                linkManager.driver.setSubmode("DATA A");
            }
        },

        sendText: function (e) {
            if ((event.target.id == "data-text-input" && event.keyCode == 13) || (event.target.id != "data-text-input")) {
                var txt = $("#data-text-input").val() + " ";
                if (txt.length > 0) {
                    // Split our text in 24 character chunks and add them into the buffer:
                    this.queueText(txt);
                    $("#data-text-input").val('');
                }
            }
        },

        clearDataStream: function () {
            $('#data-stream', this.el).val("");
        },

        addfrequency: function () {
            this.ElecraftFrequencyListView.addfrequency();
        },

        setpower: function (e) {
            if ((event.target.id == "power-direct" && event.keyCode == 13) || (event.target.id != "power-direct") ||
                (event.type == "click")) {
                linkManager.driver.setPower($("#power-direct").val());
            }
        },

        setBand: function (e) {
            var band = e.target.innerText;
            linkManager.driver.setBand(band);
        },

        setSubmode: function (e) {
            var submode = e.target.innerText;
            linkManager.driver.setSubmode(submode);
        },

        setvfoa: function () {
            if ((event.target.id == "vfoa-direct" && event.keyCode == 13) || (event.target.id != "vfoa-direct")) {
                linkManager.driver.setVFO(parseFloat(this.$("#vfoa-direct").val()), "a");
            }
        },

        setvfob: function () {
            if ((event.target.id == "vfob-direct" && event.keyCode == 13) || (event.target.id != "vfob-direct")) {
                linkManager.driver.setVFO(parseFloat(this.$("#vfob-direct").val()), "b");
            }
        },

        setAG: function (e) {
            linkManager.driver.setAG(e.value);
        },
        setMG: function (e) {
            linkManager.driver.setMG(e.value);
        },

        setRG: function (e) {
            // Note: on the slider we do -60 to 0, the driver converts into KX3 internal values
            linkManager.driver.setRG(e.value);
        },

        setBW: function (e) {
            linkManager.driver.setBW(e.value);
        },

        setCT: function (e) {
            linkManager.driver.setCT(e.value);
        },
        centerCT: function () {
            linkManager.driver.setCT(9); // Special value for centering Passband
        },

        updateStatus: function (data) {
            if (data.portopen && !this.deviceinitdone) {
                linkManager.startLiveStream();
                this.deviceinitdone = true;

                // Ask the radio for a few additional things:
                // Requested power:
                linkManager.driver.getRequestedPower();
            } else if (!data.portopen) {
                this.deviceinitdone = false;
            }
        },

        sendCQ: function () {
            var mycall = $("#data-mycall").val();
            if (mycall != '') {
                $("#data-mycall-grp").removeClass("has-error");
                var templ = this.model.get('radio_data_macros').cq;
                var fields = { MYCALL: mycall };
                var key = matchTempl(templ, fields) + "\x04";
                this.queueText(key);
            } else {
                $("#data-mycall-grp").addClass("has-error");
            }
        },

        sendANS: function () {
            var ok = validateMacros();
            if (!ok)
                return;
            var me = $("#data-mycall").val();
            var you = $("#data-theircall").val();
            var templ = this.model.get('radio_data_macros').ans;
            var fields = { MYCALL: me, YOURCALL:you };
            var key = matchTempl(templ, fields) + "\x04";
            this.queueText(key);
        },

        sendKN: function () {
            var ok = validateMacros();
            if (!ok)
                return;
            var me = $("#data-mycall").val();
            var you = $("#data-theircall").val();
            var templ = this.model.get('radio_data_macros').kn;
            var fields = { MYCALL: me, YOURCALL:you };
            var key = matchTempl(templ, fields) + "\x04";
            this.queueText(key);
        },

        sendQSO: function () {
            var ok = validateMacros();
            if (!ok)
                return;
            var me = $("#data-mycall").val();
            var you = $("#data-theircall").val();
            var templ = this.model.get('radio_data_macros').qso;
            var fields = { MYCALL: me, YOURCALL:you };
            var key = matchTempl(templ, fields) + " - ";
            this.queueText(key);
        },

        sendME: function () {
            var ok = validateMacros();
            if (!ok)
                return;
            this.sendQSO();
            var me = $("#data-mycall").val();
            var you = $("#data-theircall").val();
            var templ = this.model.get('radio_data_macros').me;
            var fields = { MYCALL: me, YOURCALL:you };
            var key = matchTempl(templ, fields) + " - ";
            this.queueText(key);
            this.sendKN();
        },

        sendBRAG: function () {
            var ok = validateMacros();
            if (!ok)
                return;
            this.sendQSO();
            var me = $("#data-mycall").val();
            var you = $("#data-theircall").val();
            var templ = this.model.get('radio_data_macros').brag;
            var fields = { MYCALL: me, YOURCALL:you };
            var key = matchTempl(templ, fields) + " - ";
            this.queueText(key);
            this.sendKN();
        },

        sendSK: function () {
            var ok = validateMacros();
            if (!ok)
                return;
            var me = $("#data-mycall").val();
            var you = $("#data-theircall").val();
            var templ = this.model.get('radio_data_macros').sk;
            var fields = { MYCALL: me, YOURCALL:you };
            var key = matchTempl(templ, fields) + "\x04";
            this.queueText(key);
        },

        showInput: function (data) {
            if (data.raw == undefined)
                return; // Detect error messages which don't contain what we need.
            // Now update our display depending on the data we received:

            // If we have a pre-parsed element, use it (faster!)
            if (data.vfoa) {
                this.$("#vfoa-direct").val(data.vfoa/1e6);
                // return;
            } else if (data.vfob) {
                this.$("#vfob-direct").val(data.vfob / 1e6);
                // return;
            }
            if (data.ptt != undefined) {
                if (this.ptt == data.ptt)
                    return;
                this.ptt = data.ptt;
                // Adjust the Bargraph here:
                // so that we don't do this later and waste cycles
                for (var i = 0; i < 20; i++) {
                    this.$('#bgs' + i).hide();
                }
                this.slevel = 0;
            }

            // No pre-parsed data, we are using the raw
            // string in the packet:
            var cmd = data.raw.substr(0, 2);
            var val = data.raw.substr(2);
            if (cmd == "DB") {
                if (voltAlertEnabled) {
                    var cmd2 = data.raw.substr(2,2);
                    if (cmd2 == 'PS' || cmd2 == 'BT') {
                        // If Power supply voltage or battery voltage is enabled and we are monitoring voltage
                        var v = parseFloat(data.raw.substr(5,4));
                        if (v <= voltAlertThreshold) {
                            voltAlertBeep.play();
                        }
                    }
                }
                // VFO B Text
                if (this.oldVFOB == val)
                    return;
                this.$("#kx3 #VFOB").text(val + "    ");
                this.oldVFOB = val;
            } else if (cmd == 'BG') {
                // Bargraph
                var s = parseInt(val);
                var ofs = (this.ptt) ? 9: 0;
                // We want to optimize drawing so we only hide/unhide the`
                // difference between 2 readings

                if (s > this.slevel) {
                    // We have to show new bars above this.slevel
                    for (var i = this.slevel+ofs+1; i <= s+ofs ; i++) {
                        this.$('#bgs' + i).show();
                    }
                } else if (s < this.slevel) {
                    // We have to hide bars above s
                    for (var i = s + ofs+1 ; i <= this.slevel+ofs ; i++) {
                        this.$('#bgs' + i).hide();
                    }
                } // if s == this.slevel we do nothing, of course
                this.slevel = s;

            } else if (cmd == "DS") {
                // VFO A Text, a bit more tricky.
                // Avoid useless redraws
                if (this.oldVFOA == val)
                    return;
                if (val.length < 8) {
                    console.log("Error: VFO A buffer too short!");
                    return;
                }
                var txt = "";
                for (var i = 0; i < 8; i++) {
                    if (val.charCodeAt(i) & 0x80) // Dot on the left side of the character
                        txt += ".";
                    var val2 = val.charCodeAt(i) & 0x7F;
                    // Do replacements:
                    if (val2 == 0x40)
                        val2 = 0x20;
                    txt += String.fromCharCode(val2);
                }
                $("#kx3 #VFOA").text(txt); //
                // Now, decode icon data:
                var a = val.charCodeAt(8);
                var f = val.charCodeAt(9);
                setIcon("NB", (a & 0x40));
                setIcon("ANT1", !(a & 0x20));
                setIcon("ANT2", (a & 0x20));
                setIcon("PRE", (a & 0x10));
                setIcon("ATT", (a & 0x8));
                // Comment out the two operations below to
                // gain time: an IF packet is sent when those change
                // setIcon("RIT", (a& 0x2));
                // setIcon("XIT", (a& 0x1));

                setIcon("ATU", (f & 0x10));
                setIcon("NR", (f & 0x04));
                setIcon("SUB", (f & 0x40));

                this.oldVFOA = val;

            } else if (cmd == "PC") {
                this.$("#power-direct").val(parseInt(val));
            } else if (cmd == "AG") {
                this.$("#ag-control").slider('setValue', parseInt(val));
            } else if (cmd == "RG") {
                this.$("#rf-control").slider('setValue', parseInt(val - 250));
            } else if (cmd == "FW") {
                this.$("#bpf-control").slider('setValue', parseFloat(val / 100));
                // TODO: update filter icons
            } else if (cmd == "MG") {
                this.$("#mic-control").slider('setValue', parseInt(val));
            } else if (cmd == "IS") {
                this.$("#ct-control").slider('setValue', parseInt(val) / 1000);
            } else if (cmd == "BN") {
                var bnd = bands[parseInt(val)];
                // Update the band selection radio buttons too:
                this.$(".band-btn").removeClass("active");
                this.$("#band-" + bnd).parent().addClass("active");
            } else if (cmd == "IF") {
                // IF messages are sent in some occasions, they contain tons of info:
                setModeIcon(val.substr(27, 1));
                var rit = parseInt(val.substr(21, 1));
                setIcon('RIT', rit);
                var xit = parseInt(val.substr(22, 1));
                setIcon('XIT', xit);
                var split = parseInt(val.substr(30,1));
                setIcon('SPLT', split);
            } else if (cmd == 'FT') {
                setIcon('SPLT', parseInt(val));
            } else if (cmd == "MD") {
                setModeIcon(parseInt(val));
            } else if (cmd == 'MN') {
                menu_displayed =  !(val == "255");
            } else if (cmd == "TB") {
                var l = parseInt(val.substr(1, 2));
                var i = this.$('#data-stream');
                if (l > 0) {
                    var txt = val.substr(3);
                    var scroll = i.val() + txt;
                    i.val(scroll);
                    // Then we need to parse any callsign we find in the text:
                    // note: without the "g", will split a single callsign into its elementary parts
                    // and we deduplicate using utils.unique
                    var callsigns = utils.unique(scroll.match(/([A-Z0-9]{1,4}\/)?(\d?[A-Z]+)(\d+)([A-Z]+)(\/[A-Z0-9]{1,4})?/g));
                    var cdr = this.$("#calls-dropdown");
                    cdr.empty();
                    if (callsigns.length) {
                        callsigns.forEach(function (sign) {
                            cdr.append('<li><a onclick="$(\'#data-theircall\').val(\'' + sign + '\');\">' + sign + '</a></li>');
                        });
                    }
                }
                var r = parseInt(val.substr(0, 1));
                this.transmittingText = (r) ? true : false;
                if (this.textOutputBuffer.length > 0) {
                    if (r < 5) {
                        var txt = this.textOutputBuffer.shift();
                        var scroll = i.val() + txt;
                        i.val(scroll);
                        linkManager.driver.sendText(txt);
                    }
                }
                // Autoscroll:
                i.scrollTop(i[0].scrollHeight - i.height());
            }
        },
    });
    })();
});