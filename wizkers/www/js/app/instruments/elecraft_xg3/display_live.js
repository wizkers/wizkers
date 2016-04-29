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
            this.applyMemChange = false;
            linkManager.on('status', this.updateStatus, this);
            linkManager.on('input', this.showInput, this);
        },

        render: function () {
            var self = this;
            console.log('Main render of XG3 main view');
            this.$el.html(template());
            
            var s = Snap("#xg3-front");
            Snap.load('js/app/instruments/elecraft_xg3/XG3-path.svg', function (f) {
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
        
        events: {
          'click #vfoa-direct-btn': 'setVFO',
          'keypress input#vfoa-direct': 'setVFO',
          'click #vfomem-save': 'saveMEM',
          'click #show_beacon_help': 'showHelp',
          'click #beacon-mem-btn': 'setBeacon',
          'keypress input#beacon-mem': 'setBeacon',
          'click #send-beacon': 'sendBeacon',
          'click #send-beacon-cw': 'sendCW',
          'click #send-beacon-rtty': 'sendRTTY',
          'click #beacon-wpm-btn': 'setWPM',
          'keypress input#beacon-wpm': 'setWPM',
          'click #output-enable': 'toggleOutput',
          'click #do-sweep': 'doSweep'
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
        
        toggleOutput: function() {
          var enabled = $(event.target).is(":checked");
          linkManager.driver.outputEnable(enabled);  
        },
        
        doSweep: function() {
            // we'll do the actual sweep in the callback
            this.sweepPending = true;
            linkManager.driver.getSweepMem(1);
        },
        
        setVFO: function () {
            if ((event.target.id == "vfoa-direct" && event.keyCode == 13) || (event.target.id != "vfoa-direct")) {
                var v = this.$('#vfoa-direct').val();
                linkManager.driver.setVFO(v);
                if (!linkManager.isStreaming())
                    linkManager.startLiveStream();
            }
        },
        
        saveMEM: function() {
            this.applyMemChange = true;
            if (!linkManager.isStreaming())
                linkManager.startLiveStream();
            else
                linkManager.driver.getMems();
        },

        setWPM: function () {
            if ((event.target.id == "beacon-wpm" && event.keyCode == 13) || (event.target.id != "beacon-wpm")) {
                var v = $('#beacon-wpm').val();
                linkManager.driver.setWPM(v);
            }
        },

        setBeacon: function () {
            if ((event.target.id == "beacon-mem" && event.keyCode == 13) || (event.target.id != "beacon-mem")) {
                var v = $('#beacon-mem').val();
                linkManager.driver.setBeacon(v);
            }
        },
        
        sendBeacon: function() {
            linkManager.stopLiveStream();
            linkManager.driver.sendBeacon('');
        },
        
        sendCW: function() {
            linkManager.stopLiveStream();
            linkManager.driver.sendCW(this.$('#beacon-direct').val());
        },
        
        sendRTTY: function() {
            linkManager.stopLiveStream();
            linkManager.driver.sendRTTY(this.$('#beacon-direct').val());
        },
        
        showHelp: function() {
            this.$('#BeaconHelp').modal();
        },
        
        handleXG3Button: function (e) {
            console.log(e.target.id);
            var b = e.target.id.split('_');
            if (b[0] == 'led') {
                linkManager.driver.setBand(b[1]);
            } else if (b[0] == 'level') {
                linkManager.driver.setLevel(b[1]);
            }
            if (!linkManager.isStreaming())
                linkManager.startLiveStream();
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
        
        toFString: function(f) {
            return ("00000000000" + (parseInt(f * 1e6).toString())).slice(-11);    
        },
        
        showInput: function(data) {
            console.log(data);
            var cmdarg = data.split(',');
            if( cmdarg[0] === 'I') {
                var f = parseInt(cmdarg[1])/1e6;
                // Only change field if we are not editing it and the value is different
                if (!this.$('#vfoa-direct:focus').length && this.$('#vfoa-direct').val() != f)
                    this.$('#vfoa-direct').val(parseInt(cmdarg[1])/1e6);
                this.$('#output-enable').prop('checked', (cmdarg[4] == '01'));
                this.updateBandLED(parseInt(cmdarg[3]));
                this.updateLevelLED(parseInt(cmdarg[2]));

            } else if (cmdarg[0] == 'Q') {
                if (this.sweepPending) {
                    this.sweepPending = false;
                    var start = this.toFString(this.$('#sweep-start-1').val());
                    var stop = this.toFString(this.$('#sweep-stop-1').val());
                    var step = this.toFString(this.$('#sweep-step-1').val());
                    var time = ("00000" + (parseInt(this.$('#sweep-step-time-1').val()).toString())).slice(-5);
                    var repeat = this.$('#sweep-repeat-1').is(':checked') ? '01' : '00';
                    // Check if we have changed the arguments. If yes, then
                    // program the sweep memory. If no, just play the sweep memory
                    if ( start == cmdarg[2] && stop == cmdarg[3] &&
                        step == cmdarg[4] && time == cmdarg[5] &&
                        repeat == cmdarg[6]) {
                        linkManager.driver.doSweep();
                    } else {                
                        linkManager.driver.setSweep(start,stop,step,time,repeat);
                    }
                } else {
                    // Fill in the fields:
                    this.$('#sweep-start-1').val(parseInt(cmdarg[2])/1e6);
                    this.$('#sweep-stop-1').val(parseInt(cmdarg[3])/1e6);
                    this.$('#sweep-step-1').val(parseInt(cmdarg[4])/1e6);
                    this.$('#sweep-step-time-1').val(parseInt(cmdarg[5]));
                    this.$('#sweep-repeat-1').prop('checked', (cmdarg[6]) == '01');
                }

                } else if (cmdarg[0] === 'M') {
                // Band memories, populate the fields
                var bands = {
                    "00": "160",
                    "01": "80",
                    "02": "60",
                    "03": "40",
                    "04": "30",
                    "05": "20",
                    "06": "17",
                    "07": "15",
                    "08": "12",
                    "09": "10",
                    "10": "6",
                    "11": "2"
                };
                var f = parseInt(cmdarg[2])/1e6;
                
                if (!this.applyMemChange) {
                    this.$('#vfo-' + bands[cmdarg[1]]).val(f);
                } else {
                    // We want to update the memories: do it only if the new value
                    // is different from the current one:
                    var nf = this.$('#vfo-' + bands[cmdarg[1]]).val();
                    console.log('Current: ' + f + ' - New: ' + nf);
                    if (f != nf) {
                        linkManager.driver.setMEM(cmdarg[1], nf);
                    }
                    if (cmdarg[1] == '11')
                        this.applyMemChange = false;
                }         
            } else if (cmdarg[0] === 'WM') {
                this.$('#beacon-mem').val(cmdarg[1]);
            } else if (cmdarg[0] === 'WP') {
                this.$('#beacon-wpm').val(cmdarg[1]);
            }
        }
        
    });
});