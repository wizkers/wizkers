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
        this.livedata = [];
                
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
                    { mode: "time", show:false, timezone: this.model.get("timezone") }
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
                this.linkManager.driver.owner();
            } else {
                this.linkManager.driver.owner();
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
                if (data.state == "NORMAL") {
                    if (this.livedata.length >= this.livepoints)
                        this.livedata = this.livedata.slice(1);
                    this.livedata.push([new Date().getTime(), data.value]);
    //                this.movingAvgData = this.movingAverager(this.livedata,this.movingAvgPoints, this.movingAvgData);
                    
                    // Remap data.unit to something more pleasant, using a helper located in our
                    // link manager driver
                    var unit = this.linkManager.driver.mapUnit(data.unit);
                    
                    this.plot.setData([ { data:this.livedata, label: unit, color: this.color },
                                        ]);
                    this.plot.setupGrid(); // Time plots require this.
                    this.plot.draw();
               }
                
                // Update statistics:
                var sessionDuration = (new Date().getTime() - this.sessionStartStamp)/1000;
                $('#sessionlength',this.el).html(utils.hms(sessionDuration));

                                       /*
                if (cpm > this.maxreading) {
                    this.maxreading = cpm;
                    $('#maxreading', this.el).html(cpm);
                }
                if (cpm < this.minreading || this.minreading == -1) {
                    this.minreading = cpm;
                    $('#minreading', this.el).html(cpm);
                }
                */

            }
        } 
    },

    
    
});