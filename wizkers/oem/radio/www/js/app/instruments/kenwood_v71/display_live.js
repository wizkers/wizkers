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
 *  Kenwood V71A Live Display view
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
        template = require('js/tpl/instruments/kenwood_v71/LiveView.js');


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
            this.locked = 0;
            this.powered = true;
            this.vfo = 'VFOx';

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

            this.faceplate = Snap("#rigpic");
            Snap.load("js/app/instruments/kenwood_v71/TM-V71A.svg", function (f) {
                f.select("#layer1").click(function (e) {
                    self.handleButton(e);
                });
                self.faceplate.add(f);
                // Set display constraints for the radio panel:
                self.faceplate.attr({
                    width: "100%",
                });

                self.$("#rigpic .icon").hide();
                // Make the s-meter bars fairly transparent (the radio does not
                // support querying the S-Level
                self.$('#rigpic .vfoa-smeter-icon').css('opacity', '0.3');
                self.$('#rigpic .vfob-smeter-icon').css('opacity', '0.3');
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
            "click .store-frequency": "addfrequency",
            "keypress input#vfoa-direct": "setvfoa",
            "click #vfoa-direct-btn": "setvfoa",
            "mousewheel #vfoa-wheel": "vfoAWheel",
            "click #vfotoggle": "toggleVFO",
            "click .mode-btn": "selectMode"
        },

        vfoAWheel: function(e) {
            // console.log('Mousewheel',e);
            this.vfoangle -= e.deltaY/2 % 360;
            var tx = this.dip_x * (Math.cos(this.vfoangle*Math.PI/360));
            var ty = this.dip_y * (1+Math.sin(this.vfoangle*Math.PI/360));
            this.vfodip.transform('t' + tx + ',' + ty);
            var step = Math.floor(Math.min(Math.abs(e.deltaY)/50, 7));
            var cmd = ((e.deltaY < 0) ? 'UP' : 'DN') + step + ';FA;';
            //linkManager.sendCommand(cmd);

        },

        toggleVFO: function () {
            linkManager.driver.toggleVFO();
        },

        addfrequency: function () {
            this.ElecraftFrequencyListView.addfrequency();
        },

        selectMode: function(e) {
            var mode = e.target.innerText;
            linkManager.driver.setMode(mode);
        },

        setvfoa: function () {
            if ((event.target.id == "vfoa-direct" && event.keyCode == 13) || (event.target.id != "vfoa-direct")) {
                linkManager.driver.setVFO(parseFloat(this.$("#vfoa-direct").val()), 'a');
            }
        },

        handleButton: function (e) {
            console.log(e.target.id);
            switch (e.target.id) {
                case 'btn_lock':
                    this.locked = !this.locked;
                    linkManager.driver.lock(this.locked);
                    break;
                case 'btn_pwr':
                    this.powered = !this.powered;
                    linkManager.driver.power(this.powered);
            }
        },

        updateStatus: function (data) {
            if (data.portopen && !this.deviceinitdone) {
                linkManager.startLiveStream();
                this.deviceinitdone = true;
            } else if (!data.portopen) {
                this.deviceinitdone = false;
            }
        },

        showInput: function (data) {

            let vfoX = false;
            if (data.vfoa) {
                var f1 = ('' + (data.vfoa/1e6)).substr(0,7); // Convert to a string
                if (data.vfoa < 1e9)
                    f1 = ' ' + f1;
                // Make sure we have 8 characters:
                f1 = (f1 + '000').substr(0,8);
                this.$("#vfoa-direct").val(data.vfoa/1e6);
                this.$("#rigpic #vfoa").text(f1);
                // Toggle the right icons for freq (last three digits)
                this.$('#vfoa-5').hide();
                this.$('#vfoa-67').hide();
                this.$('#vfoa-75').hide();
                this.$('#vfoa-25').hide();
                this.$('#vfoa-33').hide();
                var lt = ('' + data.vfoa).slice(-3);
                switch (lt) {
                    case "250" :
                        this.$('#vfoa-25').show();
                        break;
                    case "500":
                        this.$('#vfoa-5').show();
                        break;
                    case "750":
                        this.$('#vfoa-75').show();
                        break;
                    case "333":
                        this.$('#vfoa-33').show();
                        break;
                    case "666":
                        this.$('#vfoa-67').show();
                        break;
                }
                vfoX = '#vfoa-';
            }
            if (data.vfob) {
                var f1 = ('' + (data.vfob/1e6)).substr(0,7); // Convert to a string
                if (data.vfob < 1e9)
                    f1 = ' ' + f1;
                // Make sure we have 8 characters:
                f1 = (f1 + '000').substr(0,8);
                this.$("#vfob-direct").val(data.vfob/1e6);
                this.$("#rigpic #vfob").text(f1);
                this.$('#vfob-5').hide();
                this.$('#vfob-75').hide();
                this.$('#vfob-25').hide();
                var lt = ('' + data.vfob).slice(-3);
                switch (lt) {
                    case "250" :
                        this.$('#vfob-25').show();
                        break;
                    case "500":
                        this.$('#vfob-5').show();
                        break;
                    case "750":
                        this.$('#vfob-75').show();
                        break;
                }
                vfoX = '#vfob-';
            }
            if (vfoX) {
                // Adjust the VFO icons:
                let o = data.vfo_options;
                switch (o.shift) {
                    case 0:
                        this.$(vfoX + 'minus').hide();
                        this.$(vfoX + 'plus').hide();
                        break;
                    case 1:
                        this.$(vfoX + 'minus').hide();
                        this.$(vfoX + 'plus').show();
                        break;
                    case 2:
                        this.$(vfoX + 'minus').show();
                        this.$(vfoX + 'plus').hide();
                        break;
                }
                if (o.tone) {
                    this.$(vfoX + 'T').show();
                } else {
                    this.$(vfoX + 'T').hide();
                }
                switch (o.mode) {
                    case 0:
                        this.$(vfoX + 'N').hide();
                        this.$('icon-AM').hide();
                        break;
                    case 1:
                        this.$(vfoX + 'N').show();
                        this.$('icon-AM').hide();
                        break;
                    case 2:
                        this.$(vfoX + 'N').hide();
                        this.$('icon-AM').show();
                        break;
                }
            }

            if (data.vfoa_sql != undefined) {
                if (data.vfoa_sql) {
                    this.$('#vfoa-busy').show();
                    this.$('#rigpic .vfoa-smeter-icon').show();
                } else {
                    this.$('#vfoa-busy').hide();
                    this.$('#rigpic .vfoa-smeter-icon').hide();
                }
            }

            if (data.vfob_sql != undefined) {
                if (data.vfob_sql) {
                    this.$('#vfob-busy').show();
                    this.$('#rigpic .vfob-smeter-icon').show();
                } else {
                    this.$('#vfob-busy').hide();
                    this.$('#rigpic .vfob-smeter-icon').hide();
                }
            }

            if (data.vfoa_power != undefined) {
                this.$('.vfoa-power-icon').hide();
                switch (data.vfoa_power) {
                    case 0:
                        this.$('#vfoa-power-H').show();
                        break;
                    case 1:
                        this.$('#vfoa-power-M').show();
                        break;
                    case 2:
                        this.$('#vfoa-power-L').show();
                        break;
                }
            }

            if (data.vfob_power != undefined) {
                this.$('.vfob-power-icon').hide();
                switch (data.vfob_power) {
                    case 0:
                        this.$('#vfob-power-H').show();
                        break;
                    case 1:
                        this.$('#vfob-power-M').show();
                        break;
                    case 2:
                        this.$('#vfob-power-L').show();
                        break;
                }
            }

            if (data.ctrl_band != undefined) {
                if (data.ctrl_band) {
                    this.$('#vfob-CTRL').show();
                    this.$('#vfoa-CTRL').hide();
                } else {
                    this.$('#vfob-CTRL').hide();
                    this.$('#vfoa-CTRL').show();
                }
            }

            if (data.ptt_band != undefined) {
                if (data.ptt_band) {
                    this.$('#vfob-PTT').show();
                    this.$('#vfoa-PTT').hide();
                } else {
                    this.$('#vfob-PTT').hide();
                    this.$('#vfoa-PTT').show();
                }
            }


            if (data.menu_settings) {
                // We can adjust lots of icons on the display based on the
                // menu settings. These are queried when we start live streaming
                let m = data.menu_settings;

                // VFO data
                let vfo_show = (m.data_band == 0 || m.data_band == 3) ? 'vfoa' : 'vfob';
                let vfo_hide = (m.data_band == 1 || m.data_band == 2) ? 'vfoa' : 'vfob';
                this.$('#' + vfo_show + '-D').show();
                this.$('#' + vfo_hide + '-D').hide();

                // BL Color, totally unnecessary but so cool
                let bg_color = (m.bl_color) ? '#90ac02' : '#ffbf01';
                this.$('.lcd-color').css('fill', bg_color);

                // Data speed
                if (m.data_speed) {
                    this.$('#icon-96').show();
                } else {
                    this.$('#icon-96').hide();
                }
            }

        },

    });
});