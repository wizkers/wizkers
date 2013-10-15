// Live view for the Fluke 289
// 
// Our model is the settings object.

window.Fluke289LiveView = Backbone.View.extend({

    initialize:function (options) {
        this.linkManager = this.options.lm;
        this.settings = this.model;
        
        this.deviceinitdone = false;
        this.plotavg = false;
        
        this.livepoints = 300; // 5 minutes @ 1 Hz
        // livedata is now an array of live data readings, because we can graph everything
        // the meter returns
        this.livedata = [[]];
        this.plotData = [];
        
        // Keep another array for moving average over the last X samples
        // In Live view, we fix this at 1 minute. In log management, we will
        // make this configurable
        this.movingAvgPoints = 60;
        this.movingAvgData = [];  // Note: used for the graph, this stores the result of the moving average
        
        // TODO: save color palette in settings ?
        // My own nice color palette:
        this.palette = ["#e27c48", "#5a3037", "#f1ca4f", "#acbe80", "#77b1a7", "#858485", "#d9c7ad" ],

        
        this.plotOptions = {
            xaxes: [{ mode: "time", show:true, timezone: this.model.get("timezone") },
                   ],
            grid: {
				hoverable: true,
				clickable: true
			},
            legend: { position: "ne" },
            colors: this.palette,
        };        
        
        this.prevStamp = 0;

        this.linkManager.on('status', this.updatestatus, this);
        this.linkManager.on('input', this.showInput, this);

    },
    
    
    events: {
    },
    
    render:function () {
        var self = this;
        console.log('Main render of Fluke289 live view');
        $(this.el).html(this.template());
        this.linkManager.requestStatus();
            
        this.color = this.palette[0];

        this.addPlot();

        return this;


    },
        
    onClose: function() {
        console.log("Fluke289 live view closing...");        
        this.linkManager.off('status', this.updatestatus, this);
        this.linkManager.off('input', this.showInput, this);
    },

    addPlot: function() {
        var self=this;
        // Now initialize the plot area:
        this.plot = $.plot($(".datachart", this.el), [ {data:[], label:"??", color:this.color} ], this.plotOptions);
    },

    updatestatus: function(data) {
        console.log("Fluke 289 live display: serial status update");
        if (this.linkManager.connected && !this.deviceinitdone) {
            this.linkManager.driver.version();
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
                this.linkManager.startLiveStream();
                this.deviceinitdone = true;                
            } else
            if (data.version != undefined) {
                if (data.version == "No device tag set") {
                    // Show the device tag set dialog
                    $('#dtModal',this.el).modal('show');
                } else {
                    $('#fwversion',this.el).html(data.version);
                    this.linkManager.startLiveStream();
                    this.deviceinitdone = true;
                }
                // this.linkManager.driver.owner();
            } else {
                // this.linkManager.driver.owner();
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
                            cl=80;
                            break;
                        case "PARTLY_EMPTY_2":
                            cl = 60;
                            break;
                        case "PARTLY_EMPTY_1":
                            cl = 40;
                            break;
                        case "ALMOST_EMPTY":
                            cl = 20;
                            break;
                        case "EMPTY":
                            cl = 0;
                            break;
                }
                $('#battery').removeClass('battery-100 battery-80 battery-60 battery-40 battery-20 battery-0');
                $('#battery').addClass('battery-'+cl);
            }
            if (data.value != undefined) {
                if (data.readingState == "NORMAL") {
                    this.trimLiveData(0);
                    this.livedata[0].push([new Date().getTime(), data.value]);
                    var unit = this.linkManager.driver.mapUnit(data.unit);
                    
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
                        var unit = this.linkManager.driver.mapUnit(reading.baseUnit) + " - " + reading.readingID;
                        // Now find out whether the user wants us to plot this:
                        var unitnosp = unit.replace(/\s/g,'_');
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