/**
 * Live view for the Fluke 289
 *
 * Our model is the instrument object.
 *
 * (c) 2014 Edouard Lafargue, ed@lafargue.name
 */

define(function(require) {
    "use strict";
    
    var $       = require('jquery'),
        _       = require('underscore'),
        Backbone = require('backbone'),
        utils    = require('app/utils'),
        tpl     = require('text!tpl/instruments/Fluke289LiveView.html'),
        template = null;
                
        try {
            template =  _.template(tpl);
            console.log("Loaded direct template");
        } catch (e) {
            // Will happen if we are packaged in a Chrome app
            try {
                console.log("Trying compiled template");
                template = require('js/tpl/Fluke289LiveView.js', function(){} , function(err) {
                            console.log("JS Preload error");
                        });
            } catch (e) {
            console.log(e);
            }
        }
    
    // Load the flot library & flot time plugin:
    require('flot');
    require('flot_time');
    require('flot_resize');

    return Backbone.View.extend({

        initialize:function (options) {

            this.deviceinitdone = false;
            this.plotavg = false;

            this.livepoints = Math.floor(Number(this.model.get('liveviewspan'))/Number(this.model.get('liveviewperiod')));
            // livedata is now an array of live data readings, because we can graph everything
            // the meter returns
            this.livedata = [[]];
            this.plotData = [];

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

            linkManager.on('status', this.updatestatus, this);
            linkManager.on('input', this.showInput, this);

        },

        render:function () {
            var self = this;
            console.log('Main render of Fluke289 live view');
            $(this.el).html(template());
            linkManager.requestStatus();
            this.color = this.palette[0];
            this.addPlot();
            return this;
        },

        onClose: function() {
            console.log("Fluke289 live view closing...");        
            linkManager.off('status', this.updatestatus, this);
            linkManager.off('input', this.showInput, this);
        },

        addPlot: function() {
            var self=this;
            // Now initialize the plot area:
            this.plot = $.plot($(".datachart", this.el), [ {data:[], label:"??", color:this.color} ], this.plotOptions);
        },

        updatestatus: function(data) {
            console.log("Fluke 289 live display: serial status update");
            if (linkManager.connected && !this.deviceinitdone) {
                linkManager.driver.version();
            } else {
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
            // TODO : read more info @ startup...
            if (!this.deviceinitdone) {
                if (data.owner != undefined) {
                    // TODO update owner info
                    linkManager.startLiveStream();
                    this.deviceinitdone = true;                
                } else
                if (data.version != undefined) {
                    if (data.version == "No device tag set") {
                        // Show the device tag set dialog
                        $('#dtModal',this.el).modal('show');
                    } else {
                        $('#fwversion',this.el).html(data.version);
                        linkManager.startLiveStream(this.model.get('liveviewperiod'));
                        this.deviceinitdone = true;
                    }
                    // linkManager.driver.owner();
                } else {
                    // linkManager.driver.owner();
                }

            } else {
                if (data.battery != undefined) {
                    // update battery div style to reflect battery level:
                    // $('#battery',this.el).html(data.battery);
                    // purge all battery icon class:
                    var cl = 0;
                    switch(data.battery) {
                            case "FULL":
                                cl=100;
                               break;
                            case "PARTLY_EMPTY_3":
                                cl=75;
                                break;
                            case "PARTLY_EMPTY_2":
                                cl = 50;
                                break;
                            case "PARTLY_EMPTY_1":
                                cl = 25;
                                break;
                            case "ALMOST_EMPTY":
                                cl = 0;
                                break;
                            case "EMPTY": // Note: the DMM will normally not switch on at that level ?
                                cl = 0;
                                break;
                    }
                    $('#battery').removeClass('battery25-100 battery-75 battery-50 battery-25 battery-0');
                    $('#battery').addClass('battery-'+cl);
                }
                if (data.value != undefined) {
                    if (data.readingState == "NORMAL") {
                        this.trimLiveData(0);
                        this.livedata[0].push([new Date().getTime(), data.value]);
                        var unit = linkManager.driver.mapUnit(data.unit);

                        this.plot.setData([ { data:this.livedata[0], label: unit, color: this.color },
                                            ]);
                        this.plot.setupGrid(); // Time plots require this.
                        this.plot.draw();
                   }

                    // Update statistics:
                    var sessionDuration = (new Date().getTime() - this.sessionStartStamp)/1000;
                    $('#sessionlength',this.el).html(utils.hms(sessionDuration));

                }
                if (data.reading != undefined) {
                    // This is a complete reading, we have to get all readings from it
                    // and graph them.
                    var readings = data.reading.readings;
                    if (this.livedata.length != readings.length) {
                        // We need to reset our livedata structure, because the number
                        // of readings has changed.
                        this.livedata = []; // We could also use this.livedata.length = 0, it seems but that looks dodgy to me
                        while (this.livedata.length < readings.length)
                            this.livedata.push([]);
                        $('#linestoggle ul',this.el).empty();
                    }
                    var plotData = [];
                    for (var i = 0; i < readings.length; i++) {
                        var reading = readings[i];
                        if (reading.readingState == "NORMAL") {
                            this.trimLiveData(i);
                            // In some instances, the reading timestamp is zero (when it is not
                            // related to a particular time, such as a thermocouple temperature
                            // offset: this this case, we set it to the current timestamp
                            var tzOffset = new Date().getTimezoneOffset()*60000;
                            this.livedata[i].push([(reading.timeStamp == 0) ?
                                                    new Date().getTime()-tzOffset: reading.timeStamp,reading.readingValue]);
                            var unit = linkManager.driver.mapUnit(reading.baseUnit) + " - " + reading.readingID;
                            // Now find out whether the user wants us to plot this:
                            var unitnosp = reading.baseUnit + reading.readingID.replace(/\s/g,'_');
                            var toggle = $('#linestoggle ul',this.el).find('.' + unitnosp);
                            if (toggle.length == 0) {
                                // This is a new unit, we gotta add this to the toggle list
                                $('#linestoggle ul').append('<li class="'+unitnosp+'"><input type="checkbox" checked>&nbsp'+unit+'</li>');
                            } else if (toggle.find('input').is(':checked') ) {
                                plotData.push( { data: this.livedata[i],
                                                label: unit} );
                            }
                        }
                    }
                    // Now update our plot
                    this.plot.setData(plotData);
                    this.plot.setupGrid();
                    this.plot.draw();
               }

            } 
        },

        trimLiveData: function(idx) {
            if (this.livedata[idx].length >= this.livepoints) {
                    this.livedata[idx] = this.livedata[idx].slice(1);
            }
        },
    });
});