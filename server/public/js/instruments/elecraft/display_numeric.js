/**
 *  The Num View actually makes small graphs for Elecraft radios :)
 */

window.ElecraftNumView = Backbone.View.extend({

    initialize:function () {
        this.livepoints = 150; // 5 minutes @ 0.5 Hz
        this.radioPower = [];
        this.ampPower = [];
        this.reflectedPower = [];
        

        this.palette = ["#e27c48", "#5a3037", "#f1ca4f", "#acbe80", "#77b1a7", "#858485", "#d9c7ad" ],

        this.plotOptions = {
            xaxes: [{ mode: "time", show:true, timezone: settings.get("timezone")},
                   ],
            yaxis: { min:0 },
            grid: {
				hoverable: true,
				clickable: true
			},
            legend: { position: "ne" },
            colors: this.palette,
        };        
        
        this.prevStamp = 0;

        linkManager.on('input', this.showInput, this);

        
    },

    render:function () {
        $(this.el).html(this.template());
        
        this.addPlot();
        
        return this;
    },
    
    addPlot: function() {
        var self=this;
        // Now initialize the plot area:
        this.powerplot = $.plot($(".powerchart", this.el), [ {data:[], label:"W", color:this.color},
                                                     ], this.plotOptions);
    },
    

    
    onClose: function() {
        console.log("Elecraft numeric view closing...");        
        linkManager.off('input', this.showInput, this);
    },

    showInput: function(data) {
        // Now update our display depending on the data we received:
        var cmd = data.substr(0,2);
        if (cmd == "PO") {
            // Actual Power Outout
            var w = parseInt(data.substr(2))/10;
            if (this.radioPower.length >= this.livepoints) {
                this.radioPower = this.radioPower.slice(1);
            }
            var stamp = new Date().getTime();
            this.radioPower.push([stamp, w]);
            this.powerplot.setData([
                                { data:this.radioPower, label: "W", color: this.color },
                                ]);
            this.powerplot.setupGrid(); // Time plots require this.
            this.powerplot.draw();
        }
    },

});
