// Live view for the Fluke 289
// 
// Our model is the settings object.

window.FCOledLiveView = Backbone.View.extend({

    initialize:function (options) {
        this.linkManager = this.options.lm;
        this.settings = this.model;
        
        
        this.currentDevice = null;
        
        this.deviceinitdone = false;
        
        this.livepoints = 300; // 5 minutes @ 1 Hz
        this.livevolt = [];
        this.liveamp = [];
        
        this.sessionStartStamp = new Date().getTime();
        this.maxreading = 0;
        this.minreading = -1;

        
        // TODO: save color palette in settings ?
        // My own nice color palette:
        this.palette = ["#e27c48", "#5a3037", "#f1ca4f", "#acbe80", "#77b1a7", "#858485", "#d9c7ad" ],

        
        this.plotOptions = {
            xaxes: [{ mode: "time", show:true, timezone: this.model.get("timezone") },
                   ],
            yaxes: [ {}, {position:"right", min:0} ],
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
        console.log('Main render of OLED Backpack live view');
        $(this.el).html(this.template());
        this.linkManager.requestStatus();
            
        this.color = parseInt(this.settings.get('cpmcolor'));

        this.addPlot();

        return this;
    },
    
    addPlot: function() {
        var self=this;
        // Now initialize the plot area:
        console.log('Plot chart size: ' + this.$('.datachart').width());
        this.plot = $.plot($(".datachart", this.el), [ {data:[], label:"V", color:this.color},
                                                       {data:[], label:"mA"}
                                                     ], this.plotOptions);
    },
    
    onClose: function() {
        console.log("OLED Backpack view closing...");
        
        this.linkManager.off('status', this.updatestatus);
        this.linkManager.off('input', this.showInput);
        
        // Stop the live stream before leaving
        this.linkManager.stopLiveStream();

        // Restore the settings since we don't want them to be saved when changed from
        // the home screen
        this.model.fetch();
    },

        
    updatestatus: function(data) {
        console.log("OLED live display: serial status update");
    },

    
    // We get there whenever we receive something from the serial port
    showInput: function(data) {
        var self = this;
        
        // Update our raw data monitor
        /**
        var i = $('#input',this.el);
        var scroll = (i.val() + JSON.stringify(data) + '\n').split('\n');
        // Keep max 50 lines:
        if (scroll.length > 50) {
            scroll = scroll.slice(scroll.length-50);
        }
        i.val(scroll.join('\n'));
        // Autoscroll:
        i.scrollTop(i[0].scrollHeight - i.height());
        **/
        
        if (data.v != undefined && data.a != undefined) {
            var v = parseFloat(data.v);
            var a = parseFloat(data.a);
            if (this.livevolt.length >= this.livepoints)
                this.livevolt = this.livevolt.slice(1);
            if (this.liveamp.length >= this.livepoints)
                this.liveamp = this.liveamp.slice(1);
            this.livevolt.push([new Date().getTime(), v]);
            this.liveamp.push([new Date().getTime(), a]);
            this.plot.setData([ { data:this.livevolt, label: "V", color: this.color },
                               { data:this.liveamp, label: "mA", yaxis: 2 },
                                ]);
            this.plot.setupGrid(); // Time plots require this.
            this.plot.draw();
            }

        
    },

});