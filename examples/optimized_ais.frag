#define MAX_NUM_VERTICES 5
precision highp int;
precision highp float;
uniform float u_selectedId;
varying vec2 v_texCoord;
varying float v_size;

vec2 poly[MAX_NUM_VERTICES];
float segLen[MAX_NUM_VERTICES];
float vPerimeter[MAX_NUM_VERTICES];
const int n = 5;

float strokefactor = 3.;

vec4 outsidecolor = vec4(0.);

{{init}}

float isLeft(vec2 p, vec2 v0, vec2 v1) {
    return ((v1.x - v0.x) * (p.y - v0.y)
            - (p.x - v0.x) * (v1.y - v0.y));
}

// isInPoly(): winding number test for a point in a polygon
//      attrs - p: a point,
//              v: the polygon vertices,
//              n: number of vertices of the polygon
//      return: true if p is in the polygon
bool isInPoly(vec2 p, vec2 v[MAX_NUM_VERTICES], const int n){
    int wn = 0;

    for (int i=0; i<MAX_NUM_VERTICES; i++){
        if (i>=n-1) break;
        if (v[i].y <= p.y){
            if (v[i+1].y > p.y) {
                if (isLeft(p, v[i], v[i+1]) > 0.0){
                    ++wn;
                }
            }
        }
        else {
            if(v[i+1].y <= p.y){
                if (isLeft(p,v[i],v[i+1]) < 0.0){
                    --wn;
                }
            }
        }
    }
    return wn != 0;
}

//float distToLine(vec2 p, vec2 u, vec2 v){
//    return dot(v - u, p - u) / sqrt(dot(v - u, v - u));
//}

vec2 projection(vec2 p, vec2 u, vec2 v, bool isClamp){
    // Consider the line extending the segment, parameterized as u + t (v - u).
    // We find projection of point p onto the line.
    // It falls where t = [(p-u) . (v-u)] / |v-u|^2
    // We clamp t from [0,1] to handle points outside the segment vw.
    float l2 = pow(v.y - u.y, 2.0) + pow(v.x - u.x, 2.0);
    if (l2 == 0.0){
        return u;
    }
    float t = dot(p-u, v-u) / l2;
    if (isClamp)
        t = clamp(t, 0.,1.);
    return u + t*(v - u);
}
float distanceToSegment(vec2 p, vec2 u, vec2 v){
    return distance(p, projection(p,u,v,true));
}
int closestSegment(vec2 p, out vec2 u, out vec2 v, out float pDist){
    vec2 ui = poly[0];
    vec2 vi = poly[1];
    float d;
    float distMin = distanceToSegment(p, ui, vi);
    u = ui;
    v = vi;

    int ind = 0;
    for (int i=1; i < MAX_NUM_VERTICES; i++){
        if (i>=n-1) break;
        ui = poly[i];
        vi = poly[i+1];

        d = distanceToSegment(p, ui, vi);
        if (d < distMin){
            distMin = d;

            pDist = vPerimeter[i];
            ind = i;
            u = ui;
            v = vi;
        }
    }
    return ind;
}

vec4 applyStroke(float dist, float pDist, vec4 symbolcolor,
        vec4 strokecolor, float strokesize, vec2 strokeParams){
    vec4 strokeworker = strokecolor;
    float plain = strokeParams[0] * strokesize;
    float empty = strokeParams[1] * strokesize;
    if(empty == 0.)
        strokeworker =  strokecolor;
    else if(plain == 0.)
        strokeworker =  symbolcolor;
    else {
        float tot = plain + empty;
        strokeworker =  mix(strokecolor, symbolcolor,
                step(plain, mod(pDist, tot)));
    }


    // Smoothing step need more thought
    float halfStroke = strokesize/2.;
    if (dist >= halfStroke){
        strokecolor = mix(strokeworker, symbolcolor,
                smoothstep(0., 1., (dist - halfStroke) / halfStroke));
    } else {
        strokecolor = mix(outsidecolor, strokeworker,
                smoothstep(0., 0.6, dist / halfStroke));
    }
    return strokecolor;
}

vec4 getSquare(vec2 p,
        vec4 inputcolor, vec4 strokecolor,
        float strokesize, vec2 strokeParams){
    float dist = max(abs(p.x),abs(p.y));

    if(dist < 1. - strokesize){
        return inputcolor;
    }
    return applyStroke(1.- dist, 0., inputcolor,
            strokecolor, strokesize, strokeParams);
}

vec4 getCircle(vec2 p,
        vec4 circlecolor, vec4 strokecolor,
        float strokesize, vec2 strokeParams){
    float dist = distance(vec2(0.), p);
    if(dist > 1.){
        return outsidecolor;
    }
    if(dist < 1. - strokesize){
        return circlecolor;
    }


    return applyStroke(1. - dist, 0., circlecolor,
            strokecolor, strokesize, strokeParams);
}

vec4 getPolygon(vec2 p,
        vec4 polycolor, vec4 strokecolor,
        float strokesize, vec2 strokeParams){

    if (!isInPoly(p, poly, n))
        return outsidecolor;

    vec2 u;
    vec2 v;
    float pDist = 0.;
    int ind = closestSegment(p, u, v, pDist);
    vec2 proj = projection(p, u, v, true);

    float sDist = distanceToSegment(p, u, v);

    if (sDist > strokesize){
        return polycolor;
    }

    pDist += distance(u, proj);

    return applyStroke(sDist, pDist, polycolor,
            strokecolor, strokesize, strokeParams);
}

void main(void) {
    {{main}}
    vec2 texCoord = v_texCoord * 2.0 - vec2(1.0, 1.0);
    vec4 symbolcolor = vec4(vec3(1.), 1.);
    vec4 strokecolor = symbolcolor;
    strokecolor.rgb *= 0.2;
    vec2 strokepattern =  vec2(2.,0.)/strokefactor;

    if (b_id == u_selectedId){
        strokecolor = vec4(1.,0.,0.,1.);
        strokefactor += 2.;
    }
    float strokesize = strokefactor * 2. * (1./v_size);

    if (b_iscircle == 1.){
        gl_FragColor = getCircle(texCoord,
                symbolcolor, strokecolor,
            strokesize, strokepattern);
    } else {
        poly[0] = vec2(.0, -.6);
        poly[1] = vec2(-.5, -1.0);
        poly[2] = vec2(.0, 1.0);
        poly[3] = vec2(.5, -1.0);
        poly[4] = vec2(.0, -.6);
        segLen[0] = 0.;
        for (int i=1; i<MAX_NUM_VERTICES; i++){
            if (i>n) break;
            segLen[i] = distance(poly[i-1], poly[i]);
            vPerimeter[i] = vPerimeter[i-1] + segLen[i];
        }
        gl_FragColor = getPolygon(texCoord,
                symbolcolor, strokecolor,
                strokesize, strokepattern);
    }
    //if (v_id == u_selectedId){
    //    gl_FragColor = getSquare(texCoord,
    //            gl_FragColor, vec4(1.,0.,0.,1.),
    //            strokesize, strokepattern);
    //}
    gl_FragColor *= gl_FragColor.a;
}
