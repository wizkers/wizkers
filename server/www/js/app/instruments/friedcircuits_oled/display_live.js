// Live view for the Fried Circuits OLED backpack
// 
// Our model is the settings object.
//
// (c) 2014 Edouard Lafargue, ed@lafargue.name
//

define(function(require) {
    "use strict";
    
    var $       = require('jquery'),
        _       = require('underscore'),
        Backbone = require('backbone'),
        utils    = require('app/utils'),
        tpl     = require('text!tpl/instruments/FCOledLiveView.html'),
        template = null;
                
        try {
            template =  _.template(tpl);
            console.log("Loaded direct template");
        } catch (e) {
            // Will happen if we are packaged in a Chrome app
            try {
                console.log("Trying compiled template");
                template = require('js/tpl/instruments/FCOledLiveView.js');
            } catch (e) {
            console.log(e);
            }
        }
    
    // Load the flot library & flot time plugin:
    require('flot');
    require('flot_time');
    require('flot_fillbetween');
    require('flot_resize');

    return Backbone.View.extend({

        initialize:function (options) {

            this.currentDevice = null;

            this.deviceinitdone = false;

            this.livepoints = 300; // 5 minutes @ 1 Hz
            this.livevolt = [];
            this.livevolt_min = [];
            this.livevolt_max = [];
            this.liveamp = [];
            this.liveamp_min = [];
            this.liveamp_max = [];

            this.sessionStartStamp = new Date().getTime();
            this.maxreading = 0;
            this.minreading = -1;

            // TODO: save color palette in settings ?
            // My own nice color palette:
            this.palette = ["#e27c48", "#5a3037", "#f1ca4f", "#acbe80", "#77b1a7", "#858485", "#d9c7ad" ],

            this.plotOptions = {
                xaxes: [{ mode: "time", show:true, timezone: settings.get("timezone") },
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

        render:function () {
            var self = this;
            console.log('Main render of OLED Backpack live view');
            $(this.el).html(template());
            linkManager.requestStatus();

            this.color = 1;

            this.addPlot();

            return this;
        },

        addPlot: function() {
            var self=this;
            // Now initialize the plot area:
            console.log('Plot chart size: ' + this.$('.datachart').width());
            this.voltplot = $.plot($(".datachart", this.el), [ {data:[], label:"V", color:this.color},
                                                           {data:[], label:"Vmin"},
                                                           {data:[], label:"Vmax"},
                                                         ], this.plotOptions);
            this.ampplot = $.plot($(".datachart2", this.el), [ {data:[], label:"mA", color:this.color},
                                                           {data:[], label:"mAmin"},
                                                           {data:[], label:"mAmax"}
                                                         ], this.plotOptions);

        },

        onClose: function() {
            console.log("OLED Backpack view closing...");

            linkManager.off('status', this.updatestatus,this);
            linkManager.off('input', this.showInput,this);

            // Stop the live stream before leaving
            linkManager.stopLiveStream();

        },


        updatestatus: function(data) {
            console.log("OLED live display: serial status update");
        },


        // We get there whenever we receive something from the serial port
        showInput: function(data) {
            var self = this;

            if (data.v != undefined && data.a != undefined) {
                var v = parseFloat(data.v.avg);
                var v_min = parseFloat(data.v.min);
                var v_max = parseFloat(data.v.max);
                var a = parseFloat(data.a.avg);
                var a_min = parseFloat(data.a.min);
                var a_max = parseFloat(data.a.max);
                // All tables are updated at the same time, so we test only
                // on the livevolt length
                if (this.livevolt.length >= this.livepoints) {
                    this.livevolt = this.livevolt.slice(1);
                    this.livevolt_min = this.livevolt_min.slice(1);
                    this.livevolt_max = this.livevolt_max.slice(1);
                    this.liveamp = this.liveamp.slice(1);
                    this.liveamp_min = this.liveamp_min.slice(1);
                    this.liveamp_max = this.liveamp_max.slice(1);
                }
                var stamp = new Date().getTime();
                this.livevolt.push([stamp, v]);
                this.livevolt_min.push([stamp, v_min]);
                this.livevolt_max.push([stamp, v_max]);
                this.liveamp.push([stamp, a]);
                this.liveamp_min.push([stamp, a_min]);
                this.liveamp_max.push([stamp, a_max]);
                this.voltplot.setData([
                                    { data:this.livevolt, label: "V", color: this.color },
                                    { data: this.livevolt_min, label: "Vmin", id: "vmin"},
                                    { data: this.livevolt_max, label: "Vmax", id: "vmax", lines: { show: true, fill: true }, fillBetween: "vmin"}
                                    ]);
                this.ampplot.setData([
                                    { data:this.liveamp, label: "mA" },
                                    { data: this.liveamp_min, label: "Amin",id: "amin"},
                                    { data: this.liveamp_max, label: "Amax",id: "amax", lines: { show: true, fill: true }, fillBetween: "amin"}
                                    ]);
                this.voltplot.setupGrid(); // Time plots require this.
                this.voltplot.draw();
                this.ampplot.setupGrid(); // Time plots require this.
                this.ampplot.draw();
                }
        },
    });
    
});