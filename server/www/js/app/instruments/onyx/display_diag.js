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
 * Diag and settings screen
 *
 * @author Edouard Lafargue, ed@lafargue.name
 *
 */

define(function (require) {
    "use strict";

    var $ = require('jquery'),
        _ = require('underscore'),
        Backbone = require('backbone'),
        tpl = require('text!tpl/instruments/OnyxDiagView.html'),
        template = null;

    try {
        template = _.template(tpl);
    } catch (e) {
        // Will happen if we are packaged in a Chrome app
        template = require('js/tpl/instruments/OnyxDiagView.js');
    }

    return Backbone.View.extend({

        initialize: function () {
            linkManager.on('input', this.showInput, this);

            if (!linkManager.isRecording())
                linkManager.stopLiveStream();
        },

        events: {
            "click .refresh": "refresh",
            "click .disptest": "disptest",
            "click .setrtc": "setrtc",
            "click #cmdsend": "sendcmd",
            "click #calccal": "calccal",
            "click #cmdsavecal": "savecal",
            "keypress input#manualcmd": "sendcmd",
            "click #nameset": "setdevtag",
            "keypress input#devname": "setdevtag",
            "keypress input#calfactor": "calchanged",
            "change input#calfactor": "calchanged",
            "change #advanced_settings input": "settings_advanced",
        },

        onClose: function () {
            console.log("Onyx Diag view closing...");
            linkManager.off('input', this.showInput);
        },

        render: function () {
            var self = this;
            this.$el.html(template(this.model.toJSON()));

            this.refresh();
            return this;
        },

        refresh: function () {
            $('#accessorydetect', this.el).empty();
            $('#post', this.el).removeClass('badge-success').removeClass('badge-important');
            $('#post', this.el).html("Waiting...");
            $('#post2', this.el).html('');
            // Query controller for various info:
            this.queriesDone = false;
            if (linkManager.isConnected()) {
                linkManager.driver.version();
            }
        },

        settings_advanced: function (evt) {
            var checked = $(evt.target).is(':checked');
            switch (evt.target.id) {
            case 'debug_enable':
                linkManager.driver.debug_enable(checked);
                break;
            }
        },

        calchanged: function () {
            $('#cmdsavecal', this.el).addClass('btn-danger');
        },

        calccal: function () {
            // If the value of the "desired reading" input in not null, we
            // can compute the calibration factor from it:
            var target = parseFloat($('#targetusv', this.el).val());
            if (target) {
                var usvuncal = parseFloat($('#currentusv', this.el).html());
                var calfactor = target / usvuncal;
                $('#calfactor', this.el).val(calfactor);
                this.calchanged();
            }
        },
        
        savecal: function() {
            var cal = parseFloat($('#calfactor', this.el).val());
            linkManager.driver.setcalibration(cal);
            $('#cmdsavecal', this.el).removeClass('btn-danger').addClass('btn-success');
        },


        disptest: function () {
            linkManager.driver.displaytest();
        },

        setrtc: function () {
            linkManager.driver.settime();
        },

        sendcmd: function (event) {
            // We react both to button press & Enter key press
            if ((event.target.id == "manualcmd" && event.keyCode == 13) || (event.target.id != "manualcmd"))
                linkManager.sendCommand($('#manualcmd', this.el).val());
        },

        setdevtag: function (event) {
            if ((event.target.id == "devname" && event.keyCode == 13) || (event.target.id != "devname"))
                linkManager.driver.setdevicetag($('#devname', this.el).val());
        },


        showInput: function (data) {
            // Blink the indicator to show we're getting data
            $('.comlink', this.el).toggleClass('btn-success');
            var i = $('#input', this.el);
            if (data.cpm == undefined) {
                i.val(i.val() + JSON.stringify(data) + '\n');
                // Autoscroll:
                i.scrollTop(i[0].scrollHeight - i.height());
            }

            if (data.cpm != undefined) {

                // We know that usv = cpm * 0.00294 * cal_factor, so we can
                // compute the usv/h values from the CPM.
                //
                // Moreover, we want to use the CPM30, not CPM which has a 5 minutes
                // window which is way to large during calibration.
                var cpm = parseFloat(data.cpm.cpm30);
                var usvuncal = cpm * 0.00294;
                var calfactor = parseFloat($('#calfactor', this.el).val());
                $("#currentusv", this.el).html(usvuncal.toFixed(3));
                $("#currentusvcalibrated", this.el).html((usvuncal * calfactor).toFixed(3));
            }

            if (data.version != undefined) {
                $('#version', this.el).html(data.version);
                linkManager.driver.guid();
            }

            if (data.cal != undefined) {
                $('#calfactor', this.el).val(data.cal);
                // Restart live streaming after we got all the readings (the Onyx serial
                // port cannot take a lot of commands in its buffer...)
                linkManager.startLiveStream();
            }
            if (data.guid != undefined) {
                $('#guid', this.el).html(data.guid);
                linkManager.driver.devicetag();
            }
            if (data.devicetag != undefined) {
                $('#devname', this.el).val(data.devicetag);
                linkManager.driver.getRTC();
            }
            if (data.rtc != undefined) {
                $('#time', this.el).html(new Date(parseInt(data.rtc) * 1000).toUTCString());
                linkManager.driver.getcalibration();
            }
        }
    });
});