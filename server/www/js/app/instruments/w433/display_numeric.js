/*
 * Our model is the settings object.
 *
 * (c) 2014 Edouard Lafargue, ed@lafargue.name
 * All rights reserved.
 */

define(function(require) {
    "use strict";
    
    var $       = require('jquery'),
        _       = require('underscore'),
        Backbone = require('backbone'),
        tpl     = require('text!tpl/instruments/W433NumView.html'),
                template = null;
    
        try {
            template =  _.template(tpl);
        } catch (e) {
            // Will happen if we are packaged in a Chrome app
            template = require('js/tpl/instruments/W433NumView.js');
        }

    return Backbone.View.extend({

        initialize:function (options) {
            linkManager.on('input', this.showInput, this);
            this.sensors = {};

            // Start a watchdog every minute to go over the sensors and find out
            // which ones are stale/lost:
            _.bindAll(this,"refreshSensors");
            this.watchdog = setInterval(this.refreshSensors, 60000);

        },

        render:function () {
            var self = this;
            console.log('Main render of W433 numeric view');
            $(this.el).html(template());
            return this;
        },

        onClose: function() {
            console.log("W433 numeric view closing...");
            linkManager.off('input', this.showInput, this);
            clearInterval(this.watchdog);

        },

        showInput: function(data) {
            var stamp = new Date().getTime();
            // Get sensor info: if we know it, update the value & label
            // if we don't, add it
            var sensor = data.sensor_name + " - " + data.reading_type;
            var sensordata = this.sensors[sensor];
            if (sensordata == undefined) {
                $('#sensorlist',this.el).append('<li id="' + sensor.replace(/ /g, '_') + '">' +
                                                '<span class="label label-success">&nbsp;</span>&nbsp;' +
                                                sensor + ':&nbsp;' +
                                                ((data.reading_type == 'wind' ||
                                                  data.reading_type == 'wind-gust') ? data.value.dir + '° - ' + data.value.speed + 'knt' : data.value) + '</li>');
            } else {
                $('#' + sensor.replace(/ /g, '_'), this.el).html('<span class="label label-success">&nbsp;</span>&nbsp;' +
                                                sensor + ':&nbsp;' + ((data.reading_type == 'wind' ||
                                                  data.reading_type == 'wind-gust') ? data.value.dir + '° - ' + data.value.speed + 'knt' : data.value) + '</li>');
            }
            this.sensors[sensor] = { stamp: stamp};


        },

        refreshSensors: function() {
            var self = this;
            console.log("Refresh Sensor labels in num view");
            var stamp = Date.now();
            _.each(this.sensors,function(value,key) {
                if (stamp - value.stamp > 300000) { // 5 minutes, lost
                    $('#' + key.replace(/ /g, '_'), self.el).find('.label').removeClass('label-warning').addClass('label-danger');

                } else if (stamp - value.stamp > 180000) { // 3 minutes, stale
                    $('#' + key.replace(/ /g, '_'), self.el).find('.label').removeClass('label-success').addClass('label-warning');
                }
            });
        }

    });
});