iD.Quadtree = function(connection) {
    var SM = new SphericalMercator(),
        densityThreshold = 1024;

    function Node(x, y, z) {
        this.x = x;
        this.y = y;
        this.z = z;
    }

    Node.prototype.split = function() {
        if (this.nw) return;
        var x2 = this.x * 2,
            y2 = this.y * 2,
            z1 = this.z + 1;
        this.nw = new Node(x2,     y2,     z1);
        this.ne = new Node(x2 + 1, y2,     z1);
        this.sw = new Node(x2,     y2 + 1, z1);
        this.se = new Node(x2 + 1, y2 + 1, z1);
    };

    Node.prototype.extent = function() {
        var bbox = SM.bbox(this.x, this.y, this.z);
        return iD.geo.Extent([bbox[0], bbox[1]], [bbox[2], bbox[3]]);
    };

    Node.prototype.contains = function(point) {
        point = SM.xyz([point[0], point[1], point[0], point[1]], this.z);
        return point.minX === this.x && point.minY === this.y;
    };

    Node.prototype.load = function(extent, z, dense, sparse) {
        var point = extent.center();

        if (!this.contains(point))
            return;

        if (this.data)
            return;

        if (this.z < z) {
            var ifDense = function() {
                this.nw.load(extent.intersection(this.nw.extent()), z);
                this.ne.load(extent.intersection(this.ne.extent()), z);
                this.sw.load(extent.intersection(this.sw.extent()), z);
                this.se.load(extent.intersection(this.se.extent()), z);
                if (dense) dense();
            }.bind(this);

            var ifSparse = function() {
                this.load(extent, z - 1, dense, sparse);
            }.bind(this);

            this.split();
            this.nw.load(extent, z, ifDense, ifSparse); // Only one of
            this.ne.load(extent, z, ifDense, ifSparse); // these will
            this.sw.load(extent, z, ifDense, ifSparse); // contain the
            this.se.load(extent, z, ifDense, ifSparse); // center point.

        } else if (!this.request) {
            console.log(this.x, this.y, this.z);
            this.request = connection.loadExtent(this.extent(), function(err, entities) {
                this.request = null;

                if (entities.length > densityThreshold) {
                    this.data = entities;
                    if (dense) dense();
                } else if (sparse) {
                    sparse(); // still recursing back up
                } else {
                    this.data = entities;
                }
            }.bind(this));
        }
    };

    Node.prototype.zoom = function(extent) {
        if (!this.intersects(extent))
            return 0;

        if (this.data)
            return this.z;

        if (!this.nw)
            return 16;

        return Math.max(this.nw.zoom(extent),
                        this.ne.zoom(extent),
                        this.sw.zoom(extent),
                        this.se.zoom(extent));
    };

    function quadtree(x, y, z) {
        return new Node(x, y, z)
    }

    // Maximum desired entities per tile.
    quadtree.densityThreshold = function(_) {
        if (!arguments.length) return densityThreshold;
        densityThreshold = _;
        return quadtree;
    };

    return quadtree;
};
