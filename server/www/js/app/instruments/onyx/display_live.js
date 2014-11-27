/*
 * Live view display of the output of the Onyx
 * 
 * (c) 2014 Edouard Lafargue, ed@lafargue.name
 * All rights reserved.
 */

define(function(require) {
    "use strict";
    
    var $       = require('jquery'),
        _       = require('underscore'),
        Backbone = require('backbone'),
        utils    = require('app/utils'),
        simpleplot = require('app/lib/flotplot'),
        template = require('js/tpl/instruments/OnyxLiveView.js');
        
    // Load the flot library & flot time plugin:
    require('flot');
    require('flot_time');
    require('flot_resize');


    return Backbone.View.extend({

        initialize:function (options) {

            this.currentDevice = null;
            this.showstream = settings.get('showstream');

            this.deviceinitdone = false;
            this.plotavg = false;
            
            // Get frequency and span if specified:
            var span = this.model.get('liveviewspan');     // In seconds
            var period = this.model.get('liveviewperiod'); // Polling frequency
            
            var livepoints = 300; // 5 minutes @ 1 Hz
            if (span && period) {
                livepoints = span/period;
            }
            
            // We will pass this when we create plots, this is the global
            // config for the look and feel of the plot
            this.plotoptions = {
                points: livepoints
            };

            // Keep an array for moving average over the last X samples
            // In Live view, we fix this at 1 minute. In log management, we will
            // make this configurable
            this.movingAvgPoints = 60;
            this.movingAvgData =  [];  // Note: used for the graph, this stores the result of the moving average
            this.movingAvgData2 = [];  // Note: used for the graph, this stores the result of the moving average

            this.prevStamp = 0;

            linkManager.on('status', this.updatestatus, this);
            linkManager.on('input', this.showInput, this);

        },


        events: {
            "click #setdevicetag": "setdevicetag",
        },

        render:function () {
            var self = this;
            console.log('Main render of Onyx live view');
            $(this.el).html(template());
            
            // Hide the raw data stream if we don't want it
            if (!this.showstream) {
                $('#showstream',this.el).css('visibility', 'hidden');
            }
            
            linkManager.requestStatus();
            this.addPlot();
            return this;
        },

        addPlot: function() {
            var self = this;
            
            this.plot = new simpleplot({model: this.model, settings:this.plotoptions});
            if (this.plot != null) {
                  $('.geigerchart', this.el).append(this.plot.el);
                  this.plot.render();
              }

            // Make sure the chart takes all the window height:
            var rsc = function() {
                var chartheight = window.innerHeight - $('#control-area').height() - $('.header .container').height() - 45;
                if (self.showstream)
                    chartheight -= $('#showstream').height() + 20;

                $('.geigerchart').css('height',
                                           chartheight + 'px'
                                                );
                // The simpleplot lib embeds the chart into .geigerchart
                $('.geigerchart .chart').css('height',
                                           chartheight + 'px'
                                                );

            }

            $(window).resize(rsc);
            rsc();
        },

        onClose: function() {
            console.log("Onyx live view closing...");

            linkManager.off('status', this.updatestatus);
            linkManager.off('input', this.showInput);
            
            /*
            if (!linkManager.isRecording())
                linkManager.stopLiveStream();
            */
        },

        movingAverager: function(newpoint, buffer) {
            
            buffer.push(newpoint);

            // Keep our data to the length we want
            if (buffer.length >= this.movingAvgPoints)
                buffer = buffer.slice(1);

            // Now compute the average
            var avg = 0;
            for (var i= 0; i < buffer.length; i++) {
                avg += buffer[i];
            }
            return avg/buffer.length;
            
        },

        setdevicetag: function() {
            var tag = $('#devicetagfield',this.el).val();
            linkManager.driver.setdevicetag(tag);
            $('#dtModal',this.el).modal('hide');
        },


        updatestatus: function(data) {
            console.log("Onyx live display: serial status update");
            
            // Either the port is open and we have not done our device init,
            // or the port is closed and we have to reset the device init status
            if (data.portopen && !this.deviceinitdone) {
                linkManager.driver.ping();
            } else if (!data.portopen) {
                this.deviceinitdone = false;
            }
        },


        // We get there whenever we receive something from the serial port
        showInput: function(data) {
            var self = this;

            if (this.showstream) {
                // Update our raw data monitor
                var i = $('#input',this.el);
                var scroll = (i.val() + JSON.stringify(data) + '\n').split('\n');
                // Keep max 50 lines:
                if (scroll.length > 50) {
                    scroll = scroll.slice(scroll.length-50);
                }
                i.val(scroll.join('\n'));
                // Autoscroll:
                i.scrollTop(i[0].scrollHeight - i.height());
            }

            // Have we read all we need from the device?
            if (!this.deviceinitdone) {
                linkManager.driver.devicetag();
            }
            
            if (data.devicetag != undefined) {
                if (data.devicetag == "No device tag set") {
                    // Show the device tag set dialog
                    $('#dtModal',this.el).modal('show');
                } else {
                    linkManager.startLiveStream(this.model.get('liveviewperiod'));
                    this.deviceinitdone = true;
                }
            } else {
                if (data.cpm != undefined) {
                    var cpm = parseFloat(data.cpm.value);
                    
                    this.plot.appendPoint({'name': "CPM", 'value': cpm});
                    this.plot.appendPoint({'name': "AVG", 'value': this.movingAverager(cpm, this.movingAvgData) });

                }
                if (data.cpm2 != undefined) {
                    var cpm2 = parseFloat(data.cpm2.value);
                    
                    this.plot.appendPoint({'name': "CPM2", 'value': cpm2});
                    this.plot.appendPoint({'name': "AVG2", 'value': this.movingAverager(cpm2, this.movingAvgData2) });

                }

            } 
        },
    });
    
});