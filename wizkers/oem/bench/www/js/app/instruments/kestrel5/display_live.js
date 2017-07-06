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
 * Live view display of the output of the RM Young wind monitors
 *
 * @author Edouard Lafargue, ed@lafargue.name
 */

define(function (require) {
    "use strict";

    var $ = require('jquery'),
        _ = require('underscore'),
        Backbone = require('backbone'),
        utils = require('app/utils'),
        simpleplot = require('app/lib/flotplot'),
        template = require('js/tpl/instruments/kestrel5/LiveView.js');

    return Backbone.View.extend({

        initialize: function (options) {

            this.currentDevice = null;
            this.showstream = settings.get('showstream');

            this.deviceinitdone = false;

            this.update_count = 0;

            if (vizapp.type == 'cordova') {
                var wz_settings = instrumentManager.getInstrument().get('wizkers_settings');
                if (wz_settings) {
                    if (wz_settings.screen_no_dim == 'true') {
                        keepscreenon.enable();
                    } else {
                        keepscreenon.disable();
                    }
                } else {
                    // Happens when the user never explicitely set the screen dim
                    keepscreenon.disable();
                }
            }

            // Here are all the options we can define, to pass as "settings" when creating the view:
            this.plotoptions = {
                log: false,
                showtips: true,
                selectable: false,
                vertical_stretch_parent: true,
                multiple_yaxis: false,
                plot_options: {
                    xaxis: {
                        mode: "time",
                        show: true,
                        timeformat: "%H:%M",
                        timezone: settings.get("timezone")
                    },
                    grid: {
                        hoverable: true,
                        clickable: true
                    },
                    legend: {
                        position: "ne",
                        // container: $('#legend')
                    },
                    colors: ["#e27c48", "#5a3037", "#f1ca4f", "#acbe80", "#77b1a7", "#858485", "#d9c7ad"],
                },

                get: function (key) {
                    return this[key];
                },
            };

            linkManager.on('status', this.updatestatus, this);
            linkManager.on('input', this.showInput, this);

        },


        events: {},

        render: function () {
            var self = this;
            console.log('Main render of Kestrel 5 view');
            this.$el.html(template());

            // Hide the raw data stream if we don't want it
            if (!this.showstream) {
                $('#showstream', this.el).css('visibility', 'hidden');
            }

            linkManager.requestStatus();
            this.addPlot();
            return this;
        },

        addPlot: function () {
            var self = this;

            this.tempRHplot = new simpleplot({
                model:this.model,
                settings:this.plotoptions
            });

            if (this.tempRHplot != null) {
                this.$('#tempRHchart').append(this.tempRHplot.el);
                this.tempRHplot.render();
            }

            this.baroplot = new simpleplot({
                model:this.model,
                settings:this.plotoptions
            });

            if (this.baroplot != null) {
                this.$('#barochart').append(this.baroplot.el);
                this.baroplot.render();
            }


            // Haven't found a better way so far:
            var self = this;
            var rsc = function () {
                // We want the chart to be 16% of the screen
                self.$('.neutronplot').height(window.innerHeight * 0.16);
                if (self.neutronplot && self.neutronplot.rsc)
                    self.neutronplot.rsc();
                var chartheight = self.$('#neutronchart_row').outerHeight();
                var numviewheight = 0;
                // We want to take the numview height into account if screen is xs or sm
                if (utils.checkBreakpoint('xs') || utils.checkBreakpoint('sm'))
                    numviewheight = $('#numview').outerHeight();
                var spectrumheight = window.innerHeight - $(self.el).offset().top - chartheight - numviewheight - 50;
                self.$('#spectrum_row').show();
                if (spectrumheight < 100)
                    spectrumheight = 100; // If we dont' have space, just let the screen scroll, better
                                          // than a completely broken layout.
                self.$('.spectrumchart').height(spectrumheight);
                if (self.plot && self.plot.rsc)
                    self.plot.rsc();
            }
            if (this.rsc)
                $(window).off('resize', this.rsc);
            this.rsc = rsc;
            $(window).on('resize', this.rsc);
            rsc();
        },

        onClose: function () {
            console.log("Kromek D3S live view closing...");
            linkManager.stopLiveStream();
            linkManager.off('status', this.updatestatus);
            linkManager.off('input', this.showInput);
            if (this.rsc)
                $(window).off('resize', this.rsc);
            if (this.plot)
                this.plot.onClose();
            if (this.neutronplot)
                this.neutronplot.onClose();
        },

        updatestatus: function (data) {
            console.log("Kromek D3S live display: link status update");
            if (data.portopen && ! linkManager.isStreaming() ) {
                linkManager.driver.serial();
                linkManager.startLiveStream();
            }
        },

        // We get there whenever we receive something from the serial port
        showInput: function (data) {
            var self = this;

            if (this.showstream) {
                // Update our raw data monitor
                var i = $('#input', this.el);
                var scroll = (i.val() + JSON.stringify(data) + '\n').split('\n');
                // Keep max 50 lines:
                if (scroll.length > 50) {
                    scroll = scroll.slice(scroll.length - 50);
                }
                i.val(scroll.join('\n'));
                // Autoscroll:
                i.scrollTop(i[0].scrollHeight - i.height());
            }

            if (data.temperature != undefined) {
                this.tempRHplot.appendPoint({'name': 'T (' + data.unit.temperature + ')', 'value': data.temperature});
            }

            if (data.rel_humidity != undefined) {
                this.tempRHplot.appendPoint({'name': 'RH (' + data.unit.rel_humidity + ')', 'value': data.rel_humidity});
            }

            if (data.barometer != undefined) {
                this.baroplot.appendPoint({'name': 'Baro (' + data.unit.barometer + ')', 'value': data.barometer});
            }


        },
    });

});