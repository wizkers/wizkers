/**
 *  The Num View actually makes small graphs for Elecraft radios :)
 */

define(function(require) {
    "use strict";
    
    var $       = require('jquery'),
        _       = require('underscore'),
        Backbone = require('backbone'),
        tpl     = require('text!tpl/instruments/ElecraftNumView.html'),
        
        template = _.template(tpl);
    
    //require('bootstrap');
    require('flot');
    require('flot_time');

    return Backbone.View.extend({

            initialize:function () {
                this.livepoints = 150; // 2.5 minutes @ 1 Hz
                this.radioPower = [];
                this.ampFwdPower = [];
                this.ampReflPower = [];
                this.ampInPower = [];
                this.ampTemp = [];



                this.palette = ["#e27c48", "#5a3037", "#f1ca4f", "#acbe80", "#77b1a7", "#858485", "#d9c7ad" ],

                this.plotOptions = {
                    xaxes: [{ mode: "time", show:true, timezone: settings.get("timezone")},
                           ],
                    yaxis: { min:0 },
                    grid: {
                        hoverable: true,
                        clickable: true
                    },
                    legend: { position: "ne" },
                    colors: this.palette,
                };        

                this.prevStamp = 0;

                linkManager.on('input', this.showInput, this);
                linkManager.on('status', this.updateStatus, this);

            },

            render:function () {
                $(this.el).html(template());

                this.addPlot();

                return this;
            },

            addPlot: function() {
                var self=this;
                // Now initialize the plot area:
                this.tempplot = $.plot($(".tempchart", this.el), [ {data:[], label:"°C", color:this.color},
                                                             ], this.plotOptions);
                this.amppowerplot = $.plot($(".amppowerchart", this.el), [ {data:[], label:"W", color:this.color},
                                                             ], this.plotOptions);

            },



            onClose: function() {
                console.log("Elecraft numeric view closing...");        
                linkManager.off('input', this.showInput, this);
                linkManager.off('status', this.updateStatus, this);
            },

            updateStatus: function(data) {
                //console.log("TCP Server Connect: " + data.tcpserverconnect);
                if (typeof(data.tcpserverconnect) != 'undefined') {
                    if (data.tcpserverconnect) {
                        $('.tcp-server',this.el).html("Client connected");
                        $('.tcp-server').addClass('btn-success').removeClass('btn-danger');
                    } else {
                        $('.tcp-server',this.el).html("No TCP Client");
                        $('.tcp-server').addClass('btn-danget').removeClass('btn-success');

                    }
                }
            },

            showInput: function(data) {
                var drawPwr = false;
                var drawTemp = false;
                // Now update our display depending on the data we received:
                if (data.charAt(0) == '^') {
                    var cmd = data.substr(1,2);
                    var val = parseInt(data.substr(3))/10;
                    var stamp = new Date().getTime();
                    if (cmd == "PI") {
                        $("#kxpa-pi").html(val);
                        if (this.ampInPower.length >= this.livepoints) {
                            this.ampInPower = this.ampInPower.slice(1);
                        }
                        this.ampInPower.push([stamp, val]);
                        drawPwr = true;
                    } else if (cmd == "PF") {
                        $("#kxpa-pf").html(val);
                        if (this.ampFwdPower.length >= this.livepoints) {
                            this.ampFwdPower = this.ampFwdPower.slice(1);
                        }
                        this.ampFwdPower.push([stamp, val]);
                        drawPwr = true;
                    } else if (cmd == "PV") {
                        $("#kxpa-pv").html(val);
                        if (this.ampReflPower.length >= this.livepoints) {
                            this.ampReflPower = this.ampReflPower.slice(1);
                        }
                        this.ampReflPower.push([stamp, val]);
                        drawPwr = true;
                    } else if (cmd == "TM") {
                        $("#kxpa-tm").html(val);
                        if (this.ampTemp.length >= this.livepoints) {
                            this.ampTemp = this.ampTemp.slice(1);
                        }
                        this.ampTemp.push([stamp, val]);
                        drawTemp = true;
                    }   
                } else {
                    var cmd = data.substr(0,2);
                    if (cmd == "PO") {
                        // Actual Power Outout
                        var w = parseInt(data.substr(2))/10;
                        if (this.radioPower.length >= this.livepoints) {
                            this.radioPower = this.radioPower.slice(1);
                        }
                        var stamp = new Date().getTime();
                        this.radioPower.push([stamp, w]);
                        drawPwr = true;
                    }
                }

                if (drawPwr) {
                    this.amppowerplot.setData([
                                    { data:this.ampInPower, label: "In", color: this.color },
                                    { data:this.ampFwdPower, label: "Fwd"  },
                                    { data:this.ampReflPower, label: "R" },
                                    { data:this.radioPower, label: "KX3" }
                                    ]);
                    this.amppowerplot.setupGrid(); // Time plots require this.
                    this.amppowerplot.draw();
                }
                if (drawTemp) {
                    this.tempplot.setData([
                                    { data:this.ampTemp, label: "PA °C", color: this.color }
                                    ]);
                    this.tempplot.setupGrid(); // Time plots require this.
                    this.tempplot.draw();


                }

            },

        });
});