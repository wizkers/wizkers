// Live view for the W433 sensor
// 
// Our model is the settings object.
//
// (c) 2014 Edouard Lafargue, ed@lafargue.name

define(function(require) {
    "use strict";
    
    var $       = require('jquery'),
        _       = require('underscore'),
        Backbone = require('backbone'),
        tpl     = require('text!tpl/instruments/W433LiveView.html'),
        simpleplot = require('app/lib/flotplot'),
        template = null;
    
        try {
            template =  _.template(tpl);
        } catch (e) {
            // Will happen if we are packaged in a Chrome app
            console.log('W433Settings View: using compiled version (chrome app)');
            template = require('js/tpl/instruments/W433LiveView.js', function(){} , function(err) {
                            console.log("Compiled JS preloading error callback.");
                            });
        }

    // Load the flot library & flot time plugin:
    require('flot');
    require('flot_time');

    return Backbone.View.extend({

        initialize:function (options) {
            this.settings = this.model;
            
            this.plots = [];
            this.sensors = [];

            linkManager.on('input', this.showInput, this);

            this.livepoints = Math.floor(Number(this.settings.get('liveviewspan'))/Number(this.settings.get('liveviewperiod')));
            // livedata is an array of all readings by detected sensors
        },

        render:function () {
            $(this.el).html(template());
            return this;
        },

        addPlot: function(name) {
            var newplot = $('.charts').append('<div class="col-md-4"><h4>' + name + '</h4><div class="chart"></div></div>');
            var plot = new simpleplot({model: this.model});
            if (plot != null) {
                $('.chart', newplot).append(plot.el);
                plot.render();
                this.plots.push(plot);
            }
        },

        onClose: function() {
            console.log("W433 Live view closing");
            linkManager.off('input', this.showInput, this);
        },

        // We get there whenever we receive something from the serial port
        showInput: function(data) {
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
            
            if (data.value == null)
                return;

            // Now add the current sensor
            var sensor =data.sensor_name + " - " + data.reading_type;
            if (this.sensors.indexOf(sensor) == -1) {
                this.sensors.push(sensor);
                this.addPlot(sensor);
            }
            
            var idx = this.sensors.indexOf(sensor);
            this.plots[idx].appendPoint({'name': sensor, 'value': data.value});

        },
    });
    
});