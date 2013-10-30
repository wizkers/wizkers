// Live view for the Fluke 289
// 
// Our model is the settings object.

window.W433LiveView = Backbone.View.extend({

    initialize:function (options) {
        this.settings = this.model;        

        linkManager.on('input', this.showInput, this);
        
        this.livepoints = Math.floor(Number(this.settings.get('liveviewspan'))/Number(this.settings.get('liveviewperiod')));
        // livedata is an array of all readings by detected sensors
        this.livedata = [[]];
        this.sensors = [];
        this.plotData = [];
        
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


    },
    
    events: {

    },
    
    render:function () {
        $(this.el).html(this.template());
        this.addPlot();

        return this;
    },
                    
    addPlot: function() {
        var self=this;
        // Now initialize the plot area:
        this.plot = $.plot($(".datachart", this.el), [ {data:[], label:"??", color:this.color} ], this.plotOptions);
    },

        
    onClose: function() {
        linkManager.off('input', this.showInput);
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
        
        // Now add the current sensor
        var sensor =data.sensor_address + " - " + data.reading_type;
        if (this.sensors.indexOf(sensor) == -1) {
            this.sensors.push(sensor);
            this.livedata.push([]);
        }
        var idx = this.sensors.indexOf(sensor);
        this.trimLiveData(idx);
        this.livedata[idx].push([new Date().getTime(), data.value]);
        
        var plotData = [];
        // Now pack our live data:
        for (var i = 0; i < this.sensors.length; i++) {
            plotData.push( { data: this.livedata[i],
                                            label: this.sensors[i]} );
        
        }        
        // Now update our plot
        this.plot.setData(plotData);
        this.plot.setupGrid();
        this.plot.draw();

    },
    
    trimLiveData: function(idx) {
        if (this.livedata[idx].length >= this.livepoints) {
                this.livedata[idx] = this.livedata[idx].slice(1);
        }
    },


});