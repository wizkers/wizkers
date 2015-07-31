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
 * Live view for the W433 sensor
 * 
 * Our model is the instrument
 *
 * @author Edouard Lafargue, ed@lafargue.name
 */

define(function(require) {
    "use strict";
    
    var $       = require('jquery'),
        _       = require('underscore'),
        Backbone = require('backbone'),
        simpleplot = require('app/lib/flotplot'),
        roseplot = require('app/lib/flotwindrose'),
        template = require('js/tpl/instruments/W433LiveView.js');

    // Load the flot library & flot time plugin:
    require('flot');
    require('flot_time');

    return Backbone.View.extend({

        initialize:function (options) {
            
            this.plots = [];
            this.sensors = [];

            linkManager.on('input', this.showInput, this);

            // We will pass this when we create plots, this is the global
            // config for the look and feel of the plot
            this.plotoptions = {
                points: Math.floor(Number(this.model.get('liveviewspan'))/Number(this.model.get('liveviewperiod')))
            };
            
        },

        render:function () {
            $(this.el).html(template());
            return this;
        },

        addPlot: function(name, unit) {
          if (this.sensors.indexOf(name) == -1) {
              this.sensors.push(name);
              var newplot = $('.charts').append('<div class="col-md-4"><h4>' + name + ' - ' + unit + '</h4><div class="chartcontainer"></div></div>');
              var plot = null;
              if (name.indexOf('wind - direction') == -1)
                  plot = new simpleplot({model: this.model, settings:this.plotoptions});
              else
                  plot = new roseplot({model:this.model, settings:this.plotoptions});
              
              if (plot != null) {
                  $('.chartcontainer', newplot).append(plot.el);
                  plot.render();
                  this.plots.push(plot);
              }
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

            if (data.reading_type == 'wind' || data.reading_type == 'wind-gust') {
                // Those reading types return two values: we graph them separately
                var sensor1 = sensor + " - direction";
                var sensor2 = sensor + " - speed";
                this.addPlot(sensor1, "%");
                var idx = this.sensors.indexOf(sensor1);
                this.plots[idx].appendPoint({'name': sensor1, 'value': data.value});
                this.addPlot(sensor2, "knots");
                idx = this.sensors.indexOf(sensor2);
                this.plots[idx].appendPoint({'name': sensor2, 'value': data.value.speed});
            } else {
                this.addPlot(sensor, data.unit);
                var idx = this.sensors.indexOf(sensor);                
                this.plots[idx].appendPoint({'name': sensor, 'value': data.value});
            }

        },
    });
    
});
