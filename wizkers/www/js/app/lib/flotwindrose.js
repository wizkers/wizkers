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
 * A Wind rose Flot plot, do be used by any instrument that requires it
 *
 *
 * @author Edouard Lafargue, ed@lafargue.name
 */

define(function(require) {
    "use strict";

    var $       = require('jquery'),
        _       = require('underscore'),
        Backbone = require('backbone');

    // Load the flot library & flot time plugin:
    require('flot');
    require('flot_resize');
    require('flot_windrose');

    return Backbone.View.extend({

        // Here are all the options we can define, to pass as "settings" when creating the view:
        settings: {
            points: 150,
            instant: true,    // Add a small pointer showing current/instant wind direction
            showtips: true,
            get: function(key) {
                return this[key];
            },
        },

        initialize:function (options) {
            // Replace defaults by our own config for all keys
            // passed - if any
            if (options && options.settings) {
                for (var prop in options.settings) {
                    this.settings[prop] = options.settings[prop];
                }
            }

            // livedata is an array of all readings.
            this.livedata = [];
            this.previousPoint = null;

            this.plotOptions = {
                series:{
                    rose:{  active:true,
                            roseSize:0.8,
                            leafSize:0.5,
                            drawGrid:{
                                gridMode: "ticks",
                                labelPos: 0.5,
                                drawValue: true
                            }
                        }
                },
                grid:{
                    hoverable: true,
                    clickable: true,
                    tickLabel:["N","NNE","NE","ENE","E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW" ]
                }
            };


        },

        onClose: function () {
            try {
                // Explicitely destroy the plot, otherwise we will leak DOM references and
                // memory (https://github.com/flot/flot/issues/1129)
                if (this.plot)
                    this.plot.destroy();
            } catch (err) {
                console.log('Plot destroy error', err);
            }
        },


        render: function () {
            console.log("Rendering a flow wind rose widget");
            this.$el.html('<div class="chart" style="position: relative; min-height: 350px;"></div>');
            this.addPlot();
            return this;
        },

        addPlot: function() {
            var d1 = [ 1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1];
            var data = [
                { label: "8+",  color:"red", data: d1, rose: {show: true } },
                { label: "4-7", color:{colors:["yellow","orange","red"] }, data: d1, rose: {show: true } },
                { label: "1-3", color:"green", data: d1, rose: {show: true} }
            ];

            this.plot = $.plot($(".chart", this.el),data, this.plotOptions);

        },

        trimLiveData: function() {
            if (this.livedata.length >= this.settings.points) {
                    this.livedata = this.livedata.slice(1);
            }
        },

        // Append a data point. Data should be in the form of
        // { name: "measurement_name", value: { dir: dir, speed: speed} } or
        // { name: "measurement_name", value:{ dir: dir, speed: speed}, timestamp: timestamp }
        fastAppendPoint: function(data) {
            if (this.settings.points) this.trimLiveData();
            var stamp = (data.timestamp) ? new Date(data.timestamp).getTime(): new Date().getTime();
            this.livedata.push({stamp: stamp, dir: data.value.dir, speed: data.value.speed});
        },

        redraw: function() {
            if (this.livedata.length < 2)
               return;
            var force13 = [ 1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]; // Wind < 10 knt
            var force47 = [ 1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]; // Wind < 33 knt
            var force8p = [ 1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1], // Wind > 33 knt
                latest = 0;
            // Now pack our live data:
            for (var i = 1; i < this.livedata.length; i++) {
                var data = this.livedata[i-1];
                var duration = this.livedata[i].stamp - data.stamp;
                var dir = data.dir/22.5;
                if (data.speed < 10) {
                    force13[dir] += duration;
                } else if (data.speed < 33) {
                    force47[dir] += duration;
                } else {
                    force8p[dir] += duration;
                }
            }
            var timespan = this.livedata[this.livedata.length-1].stamp - this.livedata[0].stamp;
            // Then stack the data
            for (var i = 0; i < 16; i++) {
                force13[i] = force13[i]/timespan*100;
                force47[i] = force47[i]/timespan*100;
                force8p[i] = force8p[i]/timespan*100;
                force47[i] += force13[i];
                force8p[i] += force47[i];
            }


            // Get the latest wind speed in the live data, to draw a nice pointer around it:
            if (this.settings.instant) {
                latest = this.livedata[this.livedata.length-1].dir;
            }
            // Last, format it nicely;
            var data = [
                { label: "8+",   color:"red", data: force8p, rose: {show: true } },
                { label: "4-7",  color:{colors:["yellow","orange","red"] }, data: force47, rose: {show: true } },
                { label: "1-3",  color:"green", data: force13, rose: {show: true} },
                { color:"blue", data: [ latest ], rose: {show: this.settings.instant, pointer: true} }
            ];
            // Now update our plot
            this.plot.setData(data);
            this.plot.setupGrid();
            this.plot.draw();
        },

        // This method forces a redraw and is slow: use fastAppendPoint for
        // loading a large number of points before redrawing
        appendPoint: function(data) {
            this.fastAppendPoint(data);
            this.redraw();
        }

    });

});


