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
 * Display output of Geiger counter in numeric format
 * Geiger Link provides slightly different outputs from the Onyx, so
 * we are using a different display for it:
 *
 * @author Edouard Lafargue, ed@lafargue.name
 * All rights reserved.
 */

define(function(require) {
    "use strict";

    var $       = require('jquery'),
        _       = require('underscore'),
        Backbone = require('backbone'),
        utils    = require('app/utils'),
        simpleplot = require('app/lib/flotplot'),
        roseplot = require('app/lib/flotwindrose'),
        template = require('js/tpl/instruments/kestrel5/NumView.js');


    return Backbone.View.extend({

        initialize:function (options) {
            this.sessionStartStamp = new Date().getTime();
            this.maxreading = 0;
            this.minreading = -1;
            this.maxreading_2 = 0;
            this.minreading_2 = -1;
            this.valid = false;
            this.validinit = false;
            this.graph_cleared = false;


            // Get frequency and span if specified:
            var span = this.model.get('liveviewspan'); // In seconds
            var period = this.model.get('liveviewperiod'); // Polling frequency

            var livepoints = 300; // 5 minutes @ 1 Hz
            if (span && period) {
                livepoints = span / period;
            }

            // We will pass this when we create plots, this is the global
            // config for the look and feel of the plot
            this.plotoptions = {
                points: livepoints,
                vertical_stretch_parent: true,
                plot_options: {
                    xaxis: {
                        mode: "time",
                        show: true,
                        timeformat: "%H:%M",
                        timezone: settings.get("timezone")
                    },
                    grid: {
                        hoverable: true
                    },
                    legend: {
                        position: "ne"
                    }
                }
            };
            linkManager.on('input', this.showInput, this);
        },

        events: {
        },

        render:function () {
            var self = this;
            console.log('Main render of Kestrel5 numeric view');
            this.$el.html(template());
            // We need to force the Live view to resize the map at this
            // stage, becaure we just changed the size of the numview
            if (instrumentManager.liveViewRef() && instrumentManager.liveViewRef().rsc) {
                instrumentManager.liveViewRef().rsc();
            };
            this.addPlot();
            return this;
        },

        onClose: function() {
            console.log("Kestrel5 numeric view closing...");
            if (this.plot)
                this.plot.onClose();
            linkManager.off('input', this.showInput, this);
        },

        addPlot: function () {
            this.plot = new roseplot({
                model:this.model,
                settings:this.plotoptions
            });

            if (this.plot != null) {
                this.$('.roseplot').append(this.plot.el);
                this.plot.render();
            }

            this.windplot = new simpleplot({
                model: this.model,
                settings: this.plotoptions
            });
            if (this.windplot != null) {
                this.$('#windspeedchart').append(this.windplot.el);
                this.windplot.render();
            }
        },

        disp_wx: function(data,ts) {
            if (data.wind != undefined) {
                var dp = {'name': 'Wind',
                     'value': data.wind,
                      'timestamp': ts };
                if (typeof ts != 'undefined') {
                    this.plot.fastAppendPoint(dp);
                    this.windplot.fastAppendPoint({'name': 'Wind (' + data.unit.wind.speed + ')', 'value': data.wind.speed, 'timestamp': ts });
                } else {
                    this.plot.appendPoint(dp);
                    this.windplot.appendPoint({'name': 'Wind (' + data.unit.wind.speed + ')', 'value': data.wind.speed });
                    this.$('#windspeed').html((data.wind.speed).toFixed(2) + '&nbsp;' + data.unit.wind.speed);
                }
            }
        },

        clear: function () {
            this.$('.roseplot').empty();
            this.$('#windspeedchart').empty();
            this.addPlot();
            this.suspendGraph = true;
        },

        showInput: function(data) {

            if (data.replay_ts != undefined) {
                this.suspend_graph = false;
                if (!this.graph_cleared) {
                    this.graph_cleared = true;
                    this.clear();
                }
                this.disp_wx(data.data, data.replay_ts);
                return;
            }

            // We're waiting for a data replay
            if (this.suspend_graph)
                return;

            this.graph_cleared = false;

            // Grey out readings if we lost connectivity to the Kestrel 5 unit
            if (data.reconnecting != undefined ) {
                this.$('#numview_in').css('color', data.reconnecting ? '#a1a1a1' : '#000000');
            }

            this.disp_wx(data);

        },


    });
});