// Numeric view for the Fluke 289
//
// (c) 2014 Edouard Lafargue, ed@lafargue.name
// 


define(function(require) {
    "use strict";
    
    var $       = require('jquery'),
        _       = require('underscore'),
        Backbone = require('backbone'),
        utils    = require('app/utils'),
        tpl     = require('text!tpl/instruments/Fluke289NumView.html'),
        template = null;
                
        try {
            template =  _.template(tpl);
            console.log("Loaded direct template");
        } catch (e) {
            // Will happen if we are packaged in a Chrome app
            try {
                console.log("Trying compiled template");
                template = require('js/tpl/Fluke289NumView.js');
            } catch (e) {
            console.log(e);
            }
        }
    
    return Backbone.View.extend({

        initialize:function (options) {

            this.sessionStartStamp = new Date().getTime();

            linkManager.on('input', this.showInput, this);
        },

        render:function () {
            var self = this;
            console.log('Main render of FLuke289 numeric view');
            $(this.el).html(template());
            return this;
        },

        onClose: function() {
            console.log("Fluke289 numeric view closing...");
            linkManager.off('input', this.showInput, this);
        },

        showInput: function(data) {
            if (!data.error) {
                $('.commandstatus', this.el).removeClass('btn-danger').addClass('btn-success').removeClass('btn-warning');
            } else {
                $('.commandstatus', this.el).addClass('btn-danger').removeClass('btn-success').removeClass('btn-warning');
            }

            if (typeof(data.value) != 'undefined') {
                $('#livereading', this.el).html(data.value + "&nbsp;" + linkManager.driver.mapUnit(data.unit));
            }

            if (data.reading != undefined) {
                // This is a complete reading, we have to get all readings from it
                var readings = data.reading.readings;
                $('#live').empty();
                $('#primary').empty();
                $('#seconary').empty();
                $('#temp_offset').empty();
                $('#minimum').empty();
                $('#average').empty();
                $('#maximum').empty();

                if (data.reading.minMaxStartTime == 0) {
                    $('#minmax').hide();
                } else {
                    $('#minmax').show();
                }

                for (var i = 0; i < readings.length; i++) {
                    var reading = readings[i];
                    if (reading.readingState == "NORMAL") {
                        // There are several areas where we can draw:
                        var location = "";
                        var val = Math.round(
                            parseFloat(reading.readingValue) *
                            Math.pow(10,- parseInt(reading.unitMultiplier)) *
                            Math.pow(10,parseInt(reading.decimalPlaces))) / Math.pow(10, parseInt(reading.decimalPlaces));
                        var unit = "&nbsp;" + linkManager.driver.mapUnit(reading.baseUnit, reading.unitMultiplier);
                        switch (reading.readingID) {
                                case "LIVE":
                                    location="live";
                                    val = val + unit;
                                    break;
                                case "PRIMARY":
                                    location = "primary";
                                    $('#primaryunit').html(unit);
                                    break;
                                case "SECONDARY":
                                    location = "secondary";
                                    val = val + unit;
                                    break;
                                case "TEMP_OFFSET":
                                    location = "temp_offset";
                                    val = val + unit;
                                    val = "Offset: " + val;
                                    break;
                                case "MINIMUM":
                                    location = "minimum";
                                    val = val + unit;
                                    val = "Minimum: " + val;
                                    break;
                                case "MAXIMUM":
                                    location = "maximum";
                                    val = val + unit;
                                    val = "Maximum: " + val;
                                    break;
                                case "AVERAGE":
                                    location = "average";
                                    val = val + unit;
                                    val = "Average: " + val;
                                    break;
                                case "REL_LIVE":
                                    val = val + unit;
                                    break;
                        }
                        $('#' + location).html(val);
                    }
               }
            }

            // Update statistics:
            var sessionDuration = (new Date().getTime() - this.sessionStartStamp)/1000;
            $('#sessionlength',this.el).html(utils.hms(sessionDuration));

        },

    });
});