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
 *  Yaesu FT857D Live Display view
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
        template = require('js/tpl/instruments/yaesu_ft857/LiveView.js');


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

            this.faceplate = Snap("#ft857");
            Snap.load("js/app/instruments/yaesu_ft857/FT-857.svg", function (f) {
                f.select("#layer1").click(function (e) {
                    self.handleButton(e);
                });
                self.faceplate.add(f);
                // Set display constraints for the radio panel:
                self.faceplate.attr({
                    width: "100%",
                });

                // Initialize the VFO rotating dip element:
                /*
                var c = self.faceplate.select('#vfoa-wheel');;
                var bb = c.getBBox();
                self.vfodip = self.faceplate.select('#vfoa-dip');
                var bb2 = self.vfodip.getBBox();
                self.dip_x = (bb.width-(bb2.width+ bb2.y-bb.y))/2;
                self.dip_y = (bb.height-(bb2.height + bb2.y-bb.y))/2;
                */

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

            if (data.vfoa) {
                var f = data.vfoa;
                var f2 = Math.floor(f/1e6);
                var f3 = Math.floor((f-f2*1e6)/1000);
                var f4 = (f-f2*1e6-f3*1000)/10;
                f2 = ('   ' + f2).slice(-3);
                f3 = ('000' + f3).slice(-3);
                f4 = ('00' + f4).slice(-2);
                this.$("#vfoa-direct").val(f/1e6);
                // Format frequency as "XXX.XXX.XX"
                var line2 = (f < 100) ? ' ': '';
                line2 += f2 + '.' + f3 + '.' + f4;
                this.$("#ft857 #lcd_line2").text(line2);
            }

            if (data.squelch != undefined && data.ptt == false) {
                this.$("#ft857 #busy_led").css('fill', (data.squelch) ? '#707070' : '#35e133');
            } else if (data.ptt) {
                this.$("#ft857 #busy_led").css('fill', '#ff0000');
            }

            if (data.smeter != undefined) {
                this.$("#ft857 #lcd_line3").text('S' + data.smeter);
            }

            if (data.active_vfo) {
                this.vfo = 'VFO' + data.active_vfo;
            }

            if (data.mode) {
                var line1 = this.vfo + '     ' + data.mode;
                this.$("#ft857 #lcd_line1").text(line1);
                // Update the band selection radio buttons too:
                this.$(".mode-btn").removeClass("active");
                this.$("#mode-" + data.mode).parent().addClass("active");
            }

            if (data.locked) {
                console.info("Locked state:", data.locked);
            }


        },

    });
});