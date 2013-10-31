iD.Quadtree = function(connection) {
    var SM = new SphericalMercator();

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

    Node.prototype.contains = function(point) {
        point = SM.xyz([point[0], point[1], point[0], point[1]], this.z);
        return point.minX === this.x && point.minY === this.y;
    };

    Node.prototype.probe = function(extent, z, dense, sparse) {
        var point = extent.center();

        if (!this.contains(point))
            return;

        if (this.data)
            return;

        if (this.z < z) {
            var ifDense = function() {
                this.nw.probe(extent.intersection(this.nw.extent()), z);
                this.ne.probe(extent.intersection(this.ne.extent()), z);
                this.sw.probe(extent.intersection(this.sw.extent()), z);
                this.se.probe(extent.intersection(this.se.extent()), z);
                if (dense) dense();
            }.bind(this);

            var ifSparse = function() {
                this.probe(extent, z - 1, dense, sparse);
            }.bind(this);

            this.split();
            this.nw.probe(extent, z, ifDense, ifSparse); // Only one of
            this.ne.probe(extent, z, ifDense, ifSparse); // these will
            this.sw.probe(extent, z, ifDense, ifSparse); // contain the
            this.se.probe(extent, z, ifDense, ifSparse); // center point.

        } else if (!this.request) {
            this.request = connection.loadExtent(this.extent(), function(err, data) {
                this.request = null;

                if (data.dense) {
                    this.data = data;
                    if (dense) dense();
                } else if (sparse) {
                    sparse(); // still recursing back up
                } else {
                    this.data = data;
                }
            }.bind(this));
        }
    };

    Node.prototype.intersects = function(extent) {
        extent = SM.xyz([extent[0][0], extent[0][1], extent[1][0], extent[1][1]], this.z);
        return extent.minX <= this.x &&
            extent.maxX >= this.x &&
            extent.minY <= this.y &&
            extent.maxY >= this.y;
    };

    Node.prototype.extent = function() {
        var bbox = SM.bbox(this.x, this.y, this.z);
        return iD.geo.Extent([bbox[0], bbox[1]], [bbox[2], bbox[3]]);
    };

    Node.prototype.load = function(extent) {
        if (!this.intersects(extent))
            return this.abort();

        if (this.data)
            return;

        var zoomExtent = this.zoomExtent(extent);
        if (zoomExtent[1] > this.zoom) {
            // Too dense for the given zoom level.
            this.split();
            this.nw.load(extent);
            this.ne.load(extent);
            this.sw.load(extent);
            this.se.load(extent);

        } else if (!isFinite(zoomExtent[1])) {
            this.probe(extent.center());

        } else if (!this.request) {
            this.request = connection.loadExtent(this.extent(), this.loaded.bind(this));
        }
    };

    Node.prototype.loaded = function(err, data) {
        this.data = data;
        this.request = null;
    };

    Node.prototype.abort = function() {
        if (this.request)
            this.request.abort();
        if (!this.nw)
            return;
        this.nw.abort();
        this.ne.abort();
        this.sw.abort();
        this.se.abort();
    };

    Node.prototype.zoomExtent = function(extent) {
        if (!this.intersects(extent) || !this.nw)
            return [Infinity, -Infinity];

        var nw = this.nw.zoomExtent(extent),
            ne = this.ne.zoomExtent(extent),
            sw = this.sw.zoomExtent(extent),
            se = this.se.zoomExtent(extent);

        return [
            Math.min(nw[0], ne[0], sw[0], se[0]),
            Math.max(nw[0], ne[0], sw[0], se[0])
        ];
    };

    return function(x, y, z) {
        return new Node(x, y, z)
    };
};
