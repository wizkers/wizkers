// The main screen of our app.
// 
// Our model is the settings object.

window.Fluke289NumView = Backbone.View.extend({

    initialize:function (options) {
        this.linkManager = this.options.lm;
        this.settings = this.model;
        
        this.sessionStartStamp = new Date().getTime();

        this.linkManager.on('input', this.showInput, this);
    },
    
    events: {
    },
    
    render:function () {
        var self = this;
        console.log('Main render of FLuke289 numeric view');
        $(this.el).html(this.template());
        return this;
    },
        
    onClose: function() {
        console.log("Fluke289 numeric view closing...");
        this.linkManager.off('input', this.showInput, this);
    },
    
    showInput: function(data) {
        if (typeof(data.value) != 'undefined') {
            $('#livereading', this.el).html(data.value + "&nbsp;" + this.linkManager.driver.mapUnit(data.unit));
        }
        
        if (data.reading != undefined) {
            // This is a complete reading, we have to get all readings from it
            var readings = data.reading.readings;
            $('#live').empty();
            $('#primary').empty();
            $('#seconary').empty();
            $('#offset').empty();
            $('#minimum').empty();
            $('#average').empty();
            $('#maximum').empty();
            for (var i = 0; i < readings.length; i++) {
                var reading = readings[i];
                if (reading.readingState == "NORMAL") {
                    // There are several areas where we can draw:
                    var location = "primary";
                    switch (reading.readingID) {
                            case "LIVE":
                                location="live"
                                break;
                            case "PRIMARY":
                                location = "primary";
                                break;
                            case "SECONDARY":
                                location = "secondary";
                                break;
                            case "TEMP_OFFSET":
                                location = "temp_offset";
                                reading.readingValue = "Offset: " + reading.readingValue;
                                break;
                            case "MINIMUM":
                                location = "minimum";
                                reading.readingValue = "Minimum: " + reading.readingValue;
                                break;
                            case "MAXIMUM":
                                location = "maximum";
                                reading.readingValue = "Maximum: " + reading.readingValue;
                                break;
                            case "AVERAGE":
                                location = "average";
                                reading.readingValue = "Average: " + reading.readingValue;
                                break;
                    }
                    $('#' + location).html(reading.readingValue + "&nbsp;" + this.linkManager.driver.mapUnit(reading.baseUnit));
                }
           }
        }
        
        
        // Update statistics:
        var sessionDuration = (new Date().getTime() - this.sessionStartStamp)/1000;
        $('#sessionlength',this.el).html(utils.hms(sessionDuration));

    },

    
});
