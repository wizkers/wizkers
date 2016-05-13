/**
 * (c) 2015 Edouard Lafargue, ed@lafargue.name
 *
 * This file is part of Wizkers.
 *
 * Wizkers is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Wizkers is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Wizkers.  If not, see <http://www.gnu.org/licenses/>.
 */

/*
 * Numeric view for the Fluke 289
 *
 * @author Edouard Lafargue, ed@lafargue.name
 */
define(function (require) {
    "use strict";

    var $ = require('jquery'),
        _ = require('underscore'),
        Backbone = require('backbone'),
        utils = require('app/utils'),
        template = require('js/tpl/instruments/Fluke289/Fluke289NumView.js');

    return Backbone.View.extend({

        initialize: function (options) {

            this.sessionStartStamp = new Date().getTime();

            linkManager.on('input', this.showInput, this);
        },

        render: function () {
            var self = this;
            console.log('Main render of FLuke289 numeric view');
            this.$el.html(template());
            return this;
        },

        onClose: function () {
            console.log("Fluke289 numeric view closing...");
            linkManager.off('input', this.showInput, this);
        },

        showInput: function (data) {
            if (!data.error) {
                $('.commandstatus', this.el).removeClass('btn-danger').addClass('btn-success').removeClass('btn-warning');
            } else {
                $('.commandstatus', this.el).addClass('btn-danger').removeClass('btn-success').removeClass('btn-warning');
            }

            if (typeof (data.value) != 'undefined') {
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
                            Math.pow(10, -parseInt(reading.unitMultiplier)) *
                            Math.pow(10, parseInt(reading.decimalPlaces))) / Math.pow(10, parseInt(reading.decimalPlaces));
                        var unit = "&nbsp;" + linkManager.driver.mapUnit(reading.baseUnit, reading.unitMultiplier);
                        switch (reading.readingID) {
                        case "LIVE":
                            location = "live";
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
            var sessionDuration = (new Date().getTime() - this.sessionStartStamp) / 1000;
            $('#sessionlength', this.el).html(utils.hms(sessionDuration));

        },

    });
});