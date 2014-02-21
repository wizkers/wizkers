/**
 *  The Num View actually makes small graphs for Elecraft radios :)
 */

window.ElecraftNumView = Backbone.View.extend({

    initialize:function () {
        this.livepoints = 150; // 5 minutes @ 0.5 Hz
        this.radioPower = [];
        this.ampFwdPower = [];
        this.ampReflPower = [];
        this.ampInPower = [];
        
        

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
        this.amppowerplot = $.plot($(".amppowerchart", this.el), [ {data:[], label:"W", color:this.color},
                                                     ], this.plotOptions);

    },
    

    
    onClose: function() {
        console.log("Elecraft numeric view closing...");        
        linkManager.off('input', this.showInput, this);
    },

    showInput: function(data) {
        // Now update our display depending on the data we received:
        if (data.charAt(0) == '^') {
            var cmd = data.substr(1,2);
            var val = parseInt(data.substr(3))/10;
            var stamp = new Date().getTime();
            if (cmd == "PI") {
                $("#kxpa-pi").html(val);
                if (this.ampInPower.length >= this.livepoints) {
                    this.ampInPower = this.ampInPower.slice(1);
                }
                this.ampInPower.push([stamp, val]);
            } else if (cmd == "PF") {
                $("#kxpa-pf").html(val);
                if (this.ampFwdPower.length >= this.livepoints) {
                    this.ampFwdPower = this.ampFwdPower.slice(1);
                }
                this.ampFwdPower.push([stamp, val]);
            } else if (cmd == "PV") {
                $("#kxpa-pv").html(val);
                if (this.ampReflPower.length >= this.livepoints) {
                    this.ampReflPower = this.ampReflPower.slice(1);
                }
                this.ampReflPower.push([stamp, val]);
            }
            this.amppowerplot.setData([
                                    { data:this.ampInPower, label: "In", color: this.color },
                                    { data:this.ampFwdPower, label: "Fwd"  },
                                    { data:this.ampReflPower, label: "R" },
                                    ]);
            this.amppowerplot.setupGrid(); // Time plots require this.
            this.amppowerplot.draw();

            
        } else {
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
        }
    },

});
