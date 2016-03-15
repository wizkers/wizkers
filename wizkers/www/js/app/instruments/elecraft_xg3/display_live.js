/**
 * (c) 2016 Edouard Lafargue, ed@lafargue.name
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
/*
 * Live view for the XG3 frequency reference
 *
 * Our model is the settings object.
 *
 * @author Edouard Lafargue, ed@lafargue.name
 */

define(function (require) {
    "use strict";

    var $ = require('jquery'),
        _ = require('underscore'),
        Backbone = require('backbone'),
        utils = require('app/utils'),
        Snap = require('snap'),
        template = require('js/tpl/instruments/elecraft_xg3/LiveView.js');

    return Backbone.View.extend({

        initialize: function (options) {
            this.deviceinitdone = false;
            this.currentBand = -1;
            this.currentLevel = -1;
            linkManager.on('status', this.updateStatus, this);
            linkManager.on('input', this.showInput, this);
        },

        render: function () {
            var self = this;
            console.log('Main render of XG3 main view');
            this.$el.html(template());
            
            var s = Snap("#xg3-front");
            Snap.load('js/app/instruments/elecraft_xg3/XG3-Path.svg', function (f) {
                f.select("#layer1").click(function (e) {
                    self.handleXG3Button(e);
                });
                s.add(f);
                // Set display constraints for the radio panel:
                s.attr({
                    width: "100%",
                });
            });
            return this;
        },
        
        onClose: function () {
            linkManager.off('status', this.updatestatus, this);            
            linkManager.off('input', this.showInput, this);
        },
        
        updateStatus: function (data) {
            if (data.portopen && !this.deviceinitdone) {
                linkManager.startLiveStream();
                this.deviceinitdone = true;
            } else if (!data.portopen) {
                this.deviceinitdone = false;
            }
        },
        
        handleXG3Button: function (e) {
            console.log(e.target.id);
            var b = e.target.id.split('_');
            if (b[0] == 'led') {
                linkManager.driver.setBand(b[1]);
            } else if (b[0] == 'level') {
                linkManager.driver.setLevel(b[1]);
            }
        },
        
        updateBandLED: function(band) {
            var ledOff = "#6c552a";
            var ledOn = "#fda317"
            var bands = [ 160, 80, 60, 40, 30, 20, 17, 15, 12, 10, 6, 2];
            if (band != this.currentBand) {
                this.$('#xg3-front #led_' + bands[this.currentBand]).css('fill', ledOff);
                this.$('#xg3-front #led_' + bands[band]).css('fill', ledOn);
                this.currentBand = band;
            }
        },
        
        updateLevelLED: function(level) {
            var ledOff = "#6c552a";
            var ledOn = "#fda317"
            var levels = [ 0, 33, 73, 107];
            if (level != this.currentLevel) {
                this.$('#xg3-front #level_' + levels[this.currentLevel] + '_dBm').css('fill', ledOff);
                this.$('#xg3-front #level_' + levels[level] + '_dBm').css('fill', ledOn);
                this.currentLevel = level;
            }
        },
        showInput: function(data) {
            console.log(data);
            var cmdarg = data.split(',');
            if( cmdarg[0] === 'I') {
                var f = parseInt(cmdarg[1])/1e6;
                // Only change field if we are not editing it and the value is different
                if (!this.$('#vfoa-direct:focus').length && this.$('#vfoa-direct').val() != f)
                    this.$('#vfoa-direct').val(parseInt(cmdarg[1])/1e6);
                
                this.updateBandLED(parseInt(cmdarg[3]));
                this.updateLevelLED(parseInt(cmdarg[2]));

            }
        }
        
    });
});