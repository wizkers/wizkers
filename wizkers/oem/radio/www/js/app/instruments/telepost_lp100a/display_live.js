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

/*
 * Live view display of the Telepost LP-100A
 *
 * @author Edouard Lafargue, ed@lafargue.name
 */

define(function (require) {
    "use strict";

    var $ = require('jquery'),
        _ = require('underscore'),
        Snap = require('snap'),
        Backbone = require('backbone'),
        utils = require('app/utils'),
        simpleplot = require('app/lib/flotplot'),
        template = require('js/tpl/instruments/telepost_lp100a/LiveView.js');

    var gamma = function (r, x) {
        // Reflection coefficient
        return Math.sqrt(Math.pow(r - 50, 2) + Math.pow(x, 2)) / Math.sqrt(Math.pow(r + 50, 2) + Math.pow(x, 2));
    }


    return Backbone.View.extend({

        initialize: function (options) {

            this.currentDevice = null;
            this.deviceinitdone = false;

            this.pwr = -1;
            this.peak_hold_modes = ['w', 'W', 'T'];
            this.pwr_l = 'W';
            this.swr_alrms = ['Off', '1.5', '2.0', '2.5', '3.0', 'User'];

            linkManager.on('input', this.showInput, this);
            linkManager.on('status', this.updateStatus, this);

            this.sels = {};

        },

        // Performance: cache our selectors! We update the bargraph multiple times per second,
        // don't ask jQuery to rescan the DOM each time.
        eFind: function (sel) {
            if (!this.sels[sel]) {
                this.sels[sel] = this.$(sel);
            }
            return this.sels[sel];
        },

        events: {},

        render: function () {
            var self = this;
            console.log('Main render of LP100A live view');
            this.$el.html(template());
            var faceplate = Snap("#lp100a");
            Snap.load("js/app/instruments/telepost_lp100a/lp100A-dual.svg", function (f) {
                f.select("#layer1").click(function (e) {
                    // TODO: handle the clicks here
                    self.handleButtons(e);
                });
                faceplate.add(f);
                self.$('.bg-up').hide();
                self.$('.bg-down').hide();
                // Set display constraints for the radio panel:
                faceplate.attr({
                    width: "100%",
                });
            });

            linkManager.requestStatus();
            this.addPlot();
            return this;
        },

        addPlot: function () {
            var self = this;

        },

        handleButtons: function(e) {
            console.log(e.target.id);
            switch(e.target.id) {
                case "B_ALARM":
                    linkManager.sendCommand("A");
                    break;
                case "B_PEAK":
                    linkManager.sendCommand("F");
            }
        },

        reading: function(f,swr) {
        },

        onClose: function () {
            console.log("LP100A live view closing...");
            linkManager.off('input', this.showInput);
            linkManager.off('status', this.updateStatus);
            //this.plot.onClose(); // Required to stop the plot from listening to window resize events
        },

        updateStatus: function (data) {
            if (data.portopen && !this.deviceinitdone) {
                linkManager.startLiveStream();
                this.deviceinitdone = true;
            } else if (!data.portopen) {
                this.deviceinitdone = false;
            }
        },

        // We get there whenever we receive something from the serial port
        showInput: function (data) {
            if (data.pk_hold_mode != undefined) {
                this.pwr_l  = this.peak_hold_modes[data.pk_hold_mode];
                // data.pwr is always in 'data'
                this.eFind("#vfd1").html(("    " + data.pwr.toFixed(2) + this.pwr_l).slice(-8));
            }
            if (data.pwr != this.pwr) {

                this.eFind("#vfd1").html(("    " + data.pwr.toFixed(2) + this.pwr_l).slice(-8));
                // Adjust the bargraph

                if (data.pwr > this.pwr) {
                    // We have to show new bars above this.pwr
                    for (var i = Math.floor(this.pwr); i <= data.pwr ; i++) {
                        this.eFind('#bar-' + i).show();
                    }
                } else if (data.pwr < this.pwr) {
                    // We have to hide bars above data.pwr
                    for (var i = Math.floor(data.pwr) ; i <= this.pwr ; i++) {
                        this.eFind('#bar-' + i).hide();
                    }
                }
                this.pwr = data.pwr;
                // pwr goes back to zero, put all R/PH/X/Z back to zero too:
                if (this.pwr ==0) {
                    this.eFind('#z-val').html(" 0.0");
                    this.eFind('#ph-val').html(" 0.0");
                    this.eFind('#r-val').html(" 0.0");
                    this.eFind('#x-val').html(" 0.0");
                }
            }
            if (data.swr != this.swr) {
                this.eFind("#vfd2").html('SWR ' + ( (data.pwr == 0 ) ? "-.--" : data.swr.toFixed(2)));
                // Adjust the bargraph
                data.swr = (data.pwr == 0)  ? 0 : Math.floor(data.swr*6);
                if (data.swr > this.swr) {
                    // We have to show new bars above this.pwr
                    for (var i = this.swr; i <= data.swr ; i++) {
                        this.eFind('#swr-' + i).show();
                    }
                } else if (data.swr < this.swr) {
                    // We have to hide bars above data.pwr
                    for (var i = data.swr; i <= this.swr ; i++) {
                        this.eFind('#swr-' + i).hide();
                    }
                }
                this.swr = data.swr;
            }
            if (data.swr_alrm != undefined && data.swr_alrm != this.swr_alrm) {
                this.eFind("#alarm-lvl").html("Alarm: " + this.swr_alrms[data.swr_alrm]);
                this.swr_alrm = data.swr_alrm;
            }

            if (data.pwr) {
                this.eFind('#z-val').html((data.z).toFixed(1));
                this.eFind('#ph-val').html((data.ph).toFixed(1));
                var r = (data.z*Math.cos(data.ph*Math.PI/180)).toFixed(1);
                var x = (data.z*Math.sin(data.ph*Math.PI/180)).toFixed(1);
                this.eFind('#r-val').html(r);
                this.eFind('#x-val').html(x);
            }
        },
    });

});