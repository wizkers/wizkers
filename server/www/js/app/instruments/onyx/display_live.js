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
        tpl     = require('text!tpl/instruments/OnyxLiveView.html'),
        template = null;
        
        try {
            template = _.template(tpl);
        } catch (e) {
            // Will happen if we are packaged in a Chrome app
            template = require('js/tpl/instruments/OnyxLiveView.js');
        }

    // Load the flot library & flot time plugin:
    require('flot');
    require('flot_time');
    require('flot_resize');


    return Backbone.View.extend({

        initialize:function (options) {

            this.currentDevice = null;

            this.deviceinitdone = false;
            this.plotavg = false;

            this.livepoints = 300; // 5 minutes @ 1 Hz
            this.livedata = [];


            // Keep another array for moving average over the last X samples
            // In Live view, we fix this at 1 minute. In log management, we will
            // make this configurable
            this.movingAvgPoints = 60;
            this.movingAvgData = [];  // Note: used for the graph, this stores the result of the moving average

            // TODO: save color palette in settings ?
            // My own nice color palette:
            this.palette = ["#e27c48", "#5a3037", "#f1ca4f", "#acbe80", "#77b1a7", "#858485", "#d9c7ad" ],


            this.plotOptions = {
                xaxes: [{ mode: "time", show:true, timezone: this.model.get("timezone") },
                        { mode: "time", show:false, timezone: this.model.get("timezone") }
                       ],
                grid: {
                    hoverable: true,
                    clickable: true
                },
                legend: { position: "ne" },
                colors: this.palette,
            };        

            this.prevStamp = 0;

            linkManager.on('status', this.updatestatus, this);
            linkManager.on('input', this.showInput, this);

        },


        events: {
            "click #cpmscale": "cpmScaleToggle",
            "click #plotavg": "plotavgToggle",
            "click #setdevicetag": "setdevicetag",
        },

        render:function () {
            var self = this;
            console.log('Main render of Onyx live view');
            $(this.el).html(template());
            linkManager.requestStatus();
            if (this.model.get("cpmscale") == "log")
                $("#cpmscale",this.el).attr("checked",true);
            if (this.model.get('cpmscale')=="log") {
                this.plotOptions.yaxis = {
                            min:1,
                            //ticks: [1,10,30,50,100,500,1000,1500],
                            transform: function (v) { return Math.log(v+10); },
                            inverseTransform: function (v) { return Math.exp(v)-10;}
                        };
            } else if ('yaxis' in this.plotOptions){
                delete this.plotOptions.yaxis.min;
                delete this.plotOptions.yaxis.transform;
                delete this.plotOptions.yaxis.inverseTransform;
            }

            this.color = 1;

            this.addPlot();

            return this;
        },

        addPlot: function() {
            var self=this;
            // Now initialize the plot area:
            console.log('Geiger chart size: ' + this.$('.locochart').width());
            this.plot = $.plot($(".locochart", this.el), [ {data:[], label:"CPM", color:this.color} ], this.plotOptions);
        },

        onClose: function() {
            console.log("Onyx live view closing...");

            linkManager.off('status', this.updatestatus);
            linkManager.off('input', this.showInput);
            
            if (!linkManager.isRecording())
                linkManager.stopLiveStream();

        },

        cpmScaleToggle: function(event) {
            var change = {};
            if (event.target.checked) {
                change["cpmscale"]="log";
            } else {
                change["cpmscale"]="linear";
            }
            this.model.set(change);
            // this.model.save();
            this.render();
            this.addPlot();

        },

        plotavgToggle: function(event) {

        },

        movingAverager: function(source, points, result) {
            // Use input data from source, to save the moving average of the last X points
            // of the source into the result.
            if (points > source.length)
                points = source.length;
            if (result.length >= source.length)
                result = result.slice(1);
            // Now add the new moving average at the end of the result array:
            var avg = 0;
            for (var i= (source.length-points); i < source.length; i++) {
                avg += source[i][1]; // source should be an array of [timestamp,val] arrays
            }
            avg = avg/points;
            result.push([source[source.length-1][0], avg]);
            return result;
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

            // Have we read all we need from the device?
            if (!this.deviceinitdone) {
                if (data.guid != undefined) {
                    linkManager.driver.devicetag();
                } else if (data.devicetag != undefined) {
                    if (data.devicetag == "No device tag set") {
                        // Show the device tag set dialog
                        $('#dtModal',this.el).modal('show');
                    } else {
                        $('#devicetag',this.el).html(data.devicetag);
                        linkManager.startLiveStream(settings.get('liveviewperiod'));
                        this.deviceinitdone = true;
                    }
                } else {
                    linkManager.driver.guid();
                }

            } else {
                if (data.cpm != undefined) {
                    var cpm = parseFloat(data.cpm.value);
                    if (this.livedata.length >= this.livepoints)
                        this.livedata = this.livedata.slice(1);
                    this.livedata.push([new Date().getTime(), cpm]);
                    this.movingAvgData = this.movingAverager(this.livedata,this.movingAvgPoints, this.movingAvgData);
                    this.plot.setData([ { data:this.livedata, label: "CPM", color: this.color },
                                        { data:this.movingAvgData, label: "AVG" }]);
                    this.plot.setupGrid(); // Time plots require this.
                    this.plot.draw();

                    // Update statistics:
                    var sessionDuration = (new Date().getTime() - this.sessionStartStamp)/1000;
                    $('#sessionlength',this.el).html(utils.hms(sessionDuration));

                    if (cpm > this.maxreading) {
                        this.maxreading = cpm;
                        $('#maxreading', this.el).html(cpm);
                    }
                    if (cpm < this.minreading || this.minreading == -1) {
                        this.minreading = cpm;
                        $('#minreading', this.el).html(cpm);
                    }

                }
            } 
        },
    });
    
});