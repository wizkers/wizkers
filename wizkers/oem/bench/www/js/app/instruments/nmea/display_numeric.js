/**
 * This file is part of Wizkers.io
 *
 * The MIT License (MIT)
 *  Copyright (c) 2017 Edouard Lafargue, ed@wizkers.io
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
 * Display output of GPS output
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
        template = require('js/tpl/instruments/nmea/NumView.js');


    return Backbone.View.extend({

        initialize: function (options) {
            linkManager.on('input', this.showInput, this);
            this.satIcon = null;
            this.faintSatIcon = null;
            this.constellation = {};

            // Testing
            this.az = 0;
            this.ele = 0;
        },

        events: {},

        render: function () {
            var self = this;
            console.log('Main render of GPS numeric view');
            this.$el.html(template());

            var sats = Snap("#sats");
            Snap.load("js/app/instruments/nmea/gpsEarth.svg", function (f) {
                sats.add(f);
                // Set display constraints:
                sats.attr({
                    width: "100%",
                });
                self.satIcon = sats.select("#satellite");
                // Future moves: self.satIcon.transform("t-100,0")
            });
            // We need to force the Live view to resize
            // stage, becaure we just changed the size of the numview
            if (instrumentManager.liveViewRef() && instrumentManager.liveViewRef().rsc) {
                instrumentManager.liveViewRef().rsc();
            };
            return this;
        },

        onClose: function () {
            console.log("GPS numeric view closing...");
            linkManager.off('input', this.showInput, this);
        },

        movePRN: function(prn, sat) {
            // The PRN is centered by default
            // The worldmap is 460 pixel wide, so moves
            // have to be +- 230 pixels
            var radius = 460/2;
            var l = (90-sat.el)*radius/90;
            var tx = Math.cos((90-sat.az)*Math.PI/180)*l;
            var ty = -Math.sin((90-sat.az)*Math.PI/180)*l;
            prn.transform('t' + tx + ',' + ty);
            if (!sat.used) {
                $("#sats #"+prn.id).css('opacity', '0.5');
            } else {
                $("#sats #"+prn.id).css('opacity', '1');
            }
        },

        showInput: function (data) {
            if (data.class && data.class == "SKY") {
                this.$('#siv').html(data.satellites.length);
                var sats = Array.from(data.satellites);
                // Phase 1, update our existing constellation
                for (var idx in this.constellation) {
                    var satIdx = sats.findIndex(function(item) {return item.PRN == idx;});
                    if (satIdx == -1) {
                        // Delete from the constellation
                        this.constellation[idx].remove();
                        delete this.constellation[idx];
                    } else {
                        var sat = sats[satIdx];
                        this.movePRN(this.constellation[idx], sat);
                        sats.splice(satIdx, 1);
                    }
                }
                // Phase 2, add new sats if there are any left:
                for (var idx in sats) {
                    var sat = sats[idx];
                    var newSat  = this.satIcon.clone();
                    this.constellation[sat.PRN] = newSat;
                    // Ugly, eh ? Works because there is only one text node on that icon
                    var txtId = newSat.children().find(function(item) { return item.type=="text";}).id;
                    $("#sats #" + txtId).text(sat.PRN);
                    this.movePRN(newSat, sat);
                }
            }
        },


    });
});