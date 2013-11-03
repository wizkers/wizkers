
// 
// Our model is the settings object.

window.W433NumView = Backbone.View.extend({

    initialize:function (options) {
        linkManager.on('input', this.showInput, this);
        this.sensors = {};
        
        // Start a watchdog every minute to go over the sensors and find out
        // which ones are stale/lost:
        this.watchdog = setInterval(this.refreshSensors, 60000);

    },
    
    events: {
    },
    
    render:function () {
        var self = this;
        console.log('Main render of W433 numeric view');
        $(this.el).html(this.template());
        return this;
    },
        
    onClose: function() {
        console.log("W433 numeric view closing...");
        linkManager.off('input', this.showInput, this);
        clearInterval(this.watchdog);

    },
    
    showInput: function(data) {
        var stamp = new Date().getTime();
        // Get sensor info: if we know it, update the value & badge
        // if we don't, add it
        var sensor =data.sensor_name + " - " + data.reading_type;
        var sensordata = this.sensors[sensor];
        if (sensordata == undefined) {
            $('#sensorlist',this.el).append('<li id="' + sensor.replace(/ /g, '_') + '">' +
                                            '<span class="badge badge-success">OK</span>&nbsp;' +
                                            sensor + ':&nbsp;' + data.value + '</li>');
        } else {
            $('#' + sensor.replace(/ /g, '_'), this.el).html('<span class="badge badge-success">OK</span>&nbsp;' +
                                            sensor + ':&nbsp;' + data.value);
        }
        this.sensors[sensor] = { stamp: stamp};

  
    },
    
    refreshSensors: function() {
        console.log("Refresh Sensor badges in num view");
        var stamp = new Date().getTime();
        _.each(this.sensors,function(value,key) {
            if (stamp - value.stamp > 300000) { // 5 minutes, lost
                $('#' + sensor.replace(/ /g, '_'), this.el).find('.badge').removeClass('badge-warning').addClass('badge-important');
                
            } else if (stamp - value.stamp > 180000) { // 3 minutes, stale
                $('#' + sensor.replace(/ /g, '_'), this.el).find('.badge').removeClass('badge-success').addClass('badge-warning');
            }
        });
    }
        
});
