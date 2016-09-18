// radialTree.js
import * as d3_selection from 'd3-selection';
import {extent as d3_extent} from 'd3-array';
import * as d3_scale from 'd3-scale';

export default function constructor() {

	/**
	* getSet creates a getter/setter function for a D3 component. 
	*
	* @method getSet
	* @param  {string} option - the name of the object in the string you want a getter/setter for.
	*
	* @return {function} The getter/setter function.
	*/
	function getSet(context, option) {
		return function (_) {
			if (! arguments.length) {
				return context[option];
			}

			context[option] = _;

			return radialTree;
		};
	}

	//Options object for setting up getter/setter
	//Using approach by @gneatgeek https://gist.github.com/gneatgeek/5892586
	var options = {
		radiusValue : function(d) { return d.r; },
		angleValue : function(d) { return d.a; },
		idValue : function(d) { return d.id; },

		width : 500,
		height : 500,

		margin : {top: 0, right: 0, bottom: 0, left: 0},

		radius : 250,

		innerRadius : 125,
		outerRadius : 250,

		radiusMinStep : 15,
		angleMinStep : 35,

		radiusScale : d3.scaleLinear(),
		angleScale : d3.scaleLinear().range([0 , Math.PI*2]),
		angleExtent : [],
		radiusExtent : []
	};

	var radialG;

	function radialTree(selection) {

		selection.each(function(data, i) {

			data.nodes.forEach(function(d,i){
				d.r = options.radiusValue(d);
				d.a = options.angleValue(d);
				d.id = options.idValue(d);
			});

			var map = d3.map(data.nodes, radialTree._idValue);

  			// select the element that we want to append the chart to
			radialG = d3.select(this)
				.append('g')
				.attr('transform', 'translate(' + options.width/2 + ',' + options.height/2 + ')');

			options.radiusScale.range([options.innerRadius, options.outerRadius]);

			if(options.radiusExtent.length===2){
				options.radiusScale.domain(options.radiusExtent);
			}else{
				options.radiusScale.domain(d3.extent(data.nodes, radialTree._radiusValue));
			}

			options.angleScale.domain(options.angleExtent);

			radialG.append('g').attr('class', 'background').selectAll('circle').data(new Array(2)).enter().append('circle')
				.attr('class','grid')
				.attr('r', function(d,i){
					return (options.outerRadius - options.innerRadius) * i + options.innerRadius;
				});

			radialG.select('.background').append('circle').attr('r',4).attr('class','center');

			radialG.append('g').attr('class', 'nodes').selectAll('circle').data(data.nodes).enter().append('circle')
				.attr('class', 'node')
				.attr('cx', radialTree.polarX)
				.attr('cy', radialTree.polarY)
				.attr('r', 4);

			/*radialG.append('g').attr('class', 'edges').selectAll('line').data(data.edges).enter().append('line')
				.attr('class', 'edge')
				.attr('x1', function(d,i){
					return radialTree.polarX(map.get(d[0]));
				})
				.attr('y1', function(d,i){
					return radialTree.polarY(map.get(d[0]));
				})
				.attr('x2', function(d,i){
					return radialTree.polarX(map.get(d[1]));
				})
				.attr('y2', function(d,i){
					return radialTree.polarY(map.get(d[1]));
				});*/

			var radiusStepCount = Math.floor((options.outerRadius - options.innerRadius)/(options.radiusMinStep));
			var radiusStep = (options.outerRadius - options.innerRadius)/(radiusStepCount-1);

			var radianStepCount = [];
			for(var i = 0; i<radiusStepCount; i++){
				radianStepCount.push(
					Math.floor((2*Math.PI*(options.innerRadius + i*radiusStep))/options.angleMinStep)
				);
			}

			var steps = radialG.append('g').attr('class','raster').selectAll('g.radiusStep').data(new Array(radiusStepCount)).enter().append('g')
				.attr('class', 'radiusStep');

			steps.append('circle')
				.datum(function(d,i){
					return i;
				})
				.attr('class','radiusStepCircle')
				.attr('r', function(d){
					return options.innerRadius + radiusStep*d;
				});

			var grid = [];
			steps.each(function(d,i){
				for(var ac = 0; ac < radianStepCount[i]; ac++){
					grid.push({
						r : options.radiusScale.invert((options.innerRadius + radiusStep*i)),
						a : (360/radianStepCount[i])*ac,
						o : true
					});
				}
			});

			radialG.append('g').attr('class', 'grid').selectAll('circle.radianStep')
				.data(grid)
				.enter().append('circle')
					.attr('r', 4)
					.attr('class', 'radianStep')
					.attr('cx', radialTree.polarX)
					.attr('cy', radialTree.polarY);

			var sortedNodes = [];
			data.nodes.forEach(function(d,i){
				sortedNodes.push({
					r:d.r,
					a:d.a,
					id:d.id,
					g_ref:undefined,
					g:[]
				});
			});

			//sort by angle and then by radius
			sortedNodes.sort(function(a, b){
				if(a.a < b.a){
					return -1;
				}else if(a.a > b.a){
					return 1;
				}else{
					if(a.r < b.r){
						return -1;
					}else if(a.r > b.r){
						return 1;
					}else{
						return 0;
					}
				}
			});

			sortedNodes.forEach(function(d,i){
				//Measure distance to all grid locations
				var x1 = radialTree.polarX(d),
					y1 = radialTree.polarY(d);

				grid.forEach(function(dd,ii){
					var x2 = radialTree.polarX(dd),
						y2 = radialTree.polarY(dd);

					d.g.push({
						id:ii,
						dist:radialTree.distance([x1,y1],[x2,y2])
					});

				});

				//Sort grid references by distance
				d.g.sort(function(a,b){
					if(a.dist < b.dist){
						return -1;
					}else if(a.dist > b.dist){
						return 1;
					}else{
						return 0;
					}
				});

				//Chose the closest point that is still available
				var set = false, c = 0;
				while(!set && c < d.g.length){
					if(grid[d.g[c].id].o){
						grid[d.g[c].id].o = false;
						set = true;
						d.g_ref = d.g[c].id;
					}
					c++;
				}
			});

			radialG.append('g').attr('class', 'grid').selectAll('circle.translated')
				.data(sortedNodes)
				.enter().append('circle')
					.attr('r', 4)
					.attr('class', 'translated')
					.attr('cx', function(d){
						return radialTree.polarX(grid[d.g_ref]);
					})
					.attr('cy', function(d){
						return radialTree.polarY(grid[d.g_ref]);
					});
			
			
			//Testing the distance function
			/*radialG.append('g').attr('class', 'grid').selectAll('circle.translated')
				.data(sortedNodes[0].g)
				.enter().append('circle')
					.attr('r', 4)
					.style('fill', function(d){ return 'rgba(255,100,100,'+(d.dist/500)+')'; })
					.attr('cx', function(d){
						return radialTree.polarX(grid[d.id]);
					})
					.attr('cy', function(d){
						return radialTree.polarY(grid[d.id]);
					});*/
			

			var sortMap = d3.map(sortedNodes, radialTree._idValue);

			var line = d3.line()
				.curve(d3.curveCatmullRom)
				.x(radialTree.polarX)
				.y(radialTree.polarY);

			var lines = radialG.append('g').attr('class', 'edges');

			//TODO: If two points sit on the same angle, this is likely producing an error
			data.edges.forEach(function(d){
				var path = [];

				var d1 = grid[sortMap.get(d[0]).g_ref],
					d2 = grid[sortMap.get(d[1]).g_ref];

				var r = (d1.r > d2.r)?d1.r:d2.r,
					c = r*2*Math.PI,
					c_stepCount = Math.ceil(c/10);

				var t1, t2;

				//d1 to d2 or d2 to d1
				if(d2.a > d1.a){
					t1 = d1;
					t2 = d2;
				}else{
					t1 = d2;
					t2 = d1;
				}

				var a1 = Math.abs(t2.a - t1.a),
					a2 = Math.abs((360-t2.a)+t1.a),
					ta, sa, tr, sr;

				if(a1 < a2){
					sa = t1.a;
					ta = t2.a;
					sr = t1.r;
					tr = t2.r;
				}else{
					sa = t2.a;
					ta = 360+t1.a;
					sr = t2.r;
					tr = t1.r;
				}

				for(var i = 0; i<c_stepCount; i++){
					path.push({
						a:sa + (ta-sa)/c_stepCount*i,
						r:sr + (tr-sr)/c_stepCount*i
					});
				}

				path.push({
						a:ta,
						r:tr
					});

				lines.append('path')
					.attr('class', 'circleLine')
					.attr('d', line(path));

			});

		});
	}

	radialTree.polarX = function(d){
		return options.radiusScale(radialTree._radiusValue(d)) * Math.cos(options.angleScale(radialTree._angleValue(d)));
	};

	radialTree.polarY = function(d){
		return options.radiusScale(radialTree._radiusValue(d)) * Math.sin(options.angleScale(radialTree._angleValue(d)));
	};

	radialTree._radiusValue = function(d){
		return d.r;
	};

	radialTree._angleValue = function(d){
		return d.a;
	};

	radialTree._idValue = function(d){
		return d.id;
	};

	radialTree.distance = function(p1, p2){
		return Math.sqrt(
			Math.pow((p1[0] - p2[0]), 2) + 
			Math.pow((p1[1] - p2[1]), 2)
		); 
	};

	for (var key in options) {
		radialTree[key] = getSet(options, key);
	}

	return radialTree;
}