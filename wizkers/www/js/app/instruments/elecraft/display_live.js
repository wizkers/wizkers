/**
 * (c) 2015 Edouard Lafargue, ed@lafargue.name
 *
 * This file is part of Wizkers.
 *
 * Wizkers is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Wizkers is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Wizkers.  If not, see <http://www.gnu.org/licenses/>.
 */

/**
 *  Elecraft Live Display view
 *
 * @author Edouard Lafargue, ed@lafargue.name
 */


define(function (require) {
    "use strict";

    var $ = require('jquery'),
        _ = require('underscore'),
        Backbone = require('backbone'),
        Snap = require('snap'),
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

    return Backbone.View.extend({

        initialize: function () {
            this.deviceinitdone = false;

            this.textOutputBuffer = [];
            this.transmittingText = false;
            
            this.vfoangle = 0;

            // Keep the value of the previous VFO value to avoid
            // unnecessary redraws of the front panel.
            this.oldVFOA = null;
            this.oldVFOB = null;

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

            linkManager.on('status', this.updateStatus, this);
            linkManager.on('input', this.showInput, this);
        },

        ElecraftFrequencyListView: null,
        bands: ["160m", "80m", "60m", "40m", "30m", "20m", "17m", "15m", "12m", "10m", "6m", 0, 0, 0, 0, 0, "2m"],

        render: function () {
            var self = this;
            this.$el.html(template());

            this.faceplate = Snap("#kx3");
            Snap.load("img/KX3.svg", function (f) {
                f.select("#layer1").click(function (e) {
                    self.handleKX3Button(e);
                });
                self.faceplate.add(f);
                // Set display constraints for the radio panel:
                self.faceplate.attr({
                    width: "100%",
                });
                $("#kx3 .icon").css('visibility', 'hidden');
                $("#kx3").height($("#kx3").width() * 0.42);
                
                // Initialize the VFO rotating dip element:
                var c = self.faceplate.select('#vfoa-wheel');;
                var bb = c.getBBox();
                self.vfodip = self.faceplate.select('#vfoa-dip');
                var bb2 = self.vfodip.getBBox();
                self.dip_x = (bb.width-(bb2.width+ bb2.y-bb.y))/2;
                self.dip_y = (bb.height-(bb2.height + bb2.y-bb.y))/2;

                // I was not able to make the SVG resize gracefully, so I have to do this
                $("#kx3").resize(function (e) {
                    console.log("SVG container resized");
                    $(e.target).height($(e.target).width() * 0.42);
                });

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
                $('#frequency-selector', self.el).carousel();
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
            "mousewheel #vfoa-wheel": "vfoAWheel"
        },
        
        vfoAWheel: function(e) {
            // console.log('Mousewheel',e);
            this.vfoangle -= e.deltaY/2 % 360;
            var tx = this.dip_x * (Math.cos(this.vfoangle*Math.PI/360));
            var ty = this.dip_y * (1+Math.sin(this.vfoangle*Math.PI/360));
            this.vfodip.transform('t' + tx + ',' + ty);
            var step = Math.floor(Math.min(Math.abs(e.deltaY)/50, 7));
            var cmd = ((e.deltaY < 0) ? 'UP' : 'DN') + step + ';FA;';
            linkManager.sendCommand(cmd);

        },

        hideOverflow: function () {
            // $("#xtrafunc-leftside").css('overflow', 'hidden');

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
                linkManager.driver.setVFO($("#vfoa-direct", this.el).val(), "a");
            }
        },

        setvfob: function () {
            if ((event.target.id == "vfob-direct" && event.keyCode == 13) || (event.target.id != "vfob-direct")) {
                linkManager.driver.setVFO($("#vfob-direct", this.el).val(), "b");
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

        buttonCodes: {
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
            "B_MENU": "H09"
        },

        handleKX3Button: function (e) {
            console.log(e.target.id);
            //$("#kx3 #filter-II").css("visibility", "visible");
            var code = this.buttonCodes[e.target.id];
            if (code != null) {
                linkManager.sendCommand('SW' + code + ';');
            }
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

        setIcon: function (name, visible) {
            $("#kx3 #icon_" + name).css("visibility", (visible) ? "visible" : "hidden");
        },

        setModeIcon: function (mode) {
            // We need to update all icons when moving from one mode to another, so
            // I added this helper function
            var modes = ["LSB", "USB", "CW", "FM", "AM", "DATA", "CW-REV", 0, "DATA-REV"];
            $("#kx3 .mode_icon").css('visibility', 'hidden');
            $("#kx3 #icon_" + modes[mode - 1]).css('visibility', 'visible');
        },

        validateMacros: function () {
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
            var ok = this.validateMacros();
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
            var ok = this.validateMacros();
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
            var ok = this.validateMacros();
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
            var ok = this.validateMacros();
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
            var ok = this.validateMacros();
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
            var ok = this.validateMacros();
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
            if (typeof data != "string")
                return; // data is sometimes an object when we get a serial port error
            // Now update our display depending on the data we received:
            var cmd = data.substr(0, 2);
            var val = data.substr(2);
            if (cmd == "DB") {
                // VFO B Text
                if (this.oldVFOB == val)
                    return;
                $("#kx3 #VFOB").text(val + "    ");
                this.oldVFOB = val;
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
                this.setIcon("NB", (a & 0x40));
                this.setIcon("ANT1", !(a & 0x20));
                this.setIcon("ANT2", (a & 0x20));
                this.setIcon("PRE", (a & 0x10));
                this.setIcon("ATT", (a & 0x8));
                // Comment out the two operations below to
                // gain time: an IF packet is sent when those change
                // this.setIcon("RIT", (a& 0x2));
                // this.setIcon("XIT", (a& 0x1));

                this.setIcon("ATU", (f & 0x10));
                this.setIcon("NR", (f & 0x04));

                this.oldVFOA = val;

            } else if (cmd == "PC") {
                $("#power-direct").val(parseInt(val));
            } else if (cmd == "FA") {
                var f = parseInt(val);
                // Need to do this in this order because of IEEE float precision issues
                var f2 = (f - Math.floor(f/1e6)*1e6)/1e3;
                $("#vfoa-direct").val(f/1e6);
                var st = Math.floor(f/1e6) + '.' + ((f2<100) ? '0' : '' ) + f2;
                $("#kx3 #VFOA").text(st);
            } else if (cmd == "FB") {
                $("#vfob-direct").val(parseInt(val) / 1e6);
            } else if (cmd == "AG") {
                $("#ag-control", this.el).slider('setValue', parseInt(val));
            } else if (cmd == "RG") {
                $("#rf-control", this.el).slider('setValue', parseInt(val - 250));
            } else if (cmd == "FW") {
                $("#bpf-control", this.el).slider('setValue', parseFloat(val / 100));
                // TODO: update filter icons
            } else if (cmd == "MG") {
                $("#mic-control", this.el).slider('setValue', parseInt(val));
            } else if (cmd == "IS") {
                $("#ct-control", this.el).slider('setValue', parseInt(val) / 1000);
            } else if (cmd == "BN") {
                var bnd = this.bands[parseInt(val)];
                $("#freq-slider-band", this.el).html(bnd);
                // Update the band selection radio buttons too:
                $(".band-btn", this.el).removeClass("active");
                $("#band-" + bnd).parent().addClass("active");
            } else if (cmd == "IF") {
                // IF messages are sent in some occasions, they contain tons of info:
                this.setModeIcon(val.substr(27, 1));
                var rit = parseInt(val.substr(21, 1));
                this.setIcon('RIT', rit);
                var xit = parseInt(val.substr(22, 1));
                this.setIcon('XIT', xit);
            } else if (cmd == "MD") {
                this.setModeIcon(parseInt(val));
            } else if (cmd == "TB") {
                var l = parseInt(val.substr(1, 2));
                var i = $('#data-stream', this.el);
                if (l > 0) {
                    var txt = val.substr(3);
                    var scroll = i.val() + txt;
                    i.val(scroll);
                    // Then we need to parse any callsign we find in the text:
                    // note: without the "g", will split a single callsign into its elementary parts
                    // and we deduplicate using utils.unique
                    var callsigns = utils.unique(scroll.match(/([A-Z0-9]{1,4}\/)?(\d?[A-Z]+)(\d+)([A-Z]+)(\/[A-Z0-9]{1,4})?/g));
                    var cdr = $("#calls-dropdown", this.el);
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
});