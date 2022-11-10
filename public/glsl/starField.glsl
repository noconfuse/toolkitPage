// [SH18] Woman. Created by Reinder Nijhoff 2018
// Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International License.
// @reindernijhoff
//
// https://www.shadertoy.com/view/4tdcWS
//
// I wanted to create an organic-looking SDF scene in a single, fully procedural,
// fragment shader. The scene is modelled for this specific camera viewpoint and 
// lighting setup.
//
// Please change AA (line 13) to 1 if this shader is running slow.
//

#define LAYERS 6.0
#define PI 3.141592



mat2 Rot(float a){
    float s = sin(a),c=cos(a);
    return mat2(c,-s,s,c);
}

float Hash21(vec2 p){
    p = fract(p*vec2(123.45,986.21));
    p += dot(p,p+243.);
    return fract(p.x*p.y);
}

float hash( float n )
{
return fract(cos(n)*41415.92653);
}

float noise( in vec3 x )
{
    vec3 p  = floor(x);
    vec3 f  = smoothstep(0.0, 1.0, fract(x));
    float n = p.x + p.y*57.0 + 113.0*p.z;

    return mix(mix(mix( hash(n+  0.0), hash(n+  1.0),f.x),
        mix( hash(n+ 57.0), hash(n+ 58.0),f.x),f.y),
        mix(mix( hash(n+113.0), hash(n+114.0),f.x),
        mix( hash(n+170.0), hash(n+171.0),f.x),f.y),f.z);
}


mat3 m = mat3( 0.00,  1.60,  1.20, -1.60,  0.72, -0.96, -1.20, -0.96,  1.28 );
// Fractional Brownian motion
float fbmslow( vec3 p ){
    float f = 0.5000*noise( p ); p = m*p*1.2;
    f += 0.2500*noise( p ); p = m*p*1.3;
    f += 0.1666*noise( p ); p = m*p*1.4;
    f += 0.0834*noise( p ); p = m*p*1.84;
    return f;
}

float Star(vec2 uv,float n, float flare){
    float d = length(uv);
    float m = .02/d;
    uv *= Rot(3.1415 * n);
    m += max(0.,1.-abs(uv.x*uv.y*1000.0))*flare;
    uv *= Rot(3.1415/4.);
    m += max(0.,1.-abs(uv.x*uv.y*1000.0))*.1*flare;
    m *= smoothstep(1.,.2,d);
    return m;
}

vec3 Blend(vec4 source,vec4 dest){
    return source.rgb * source.a + dest.rgb * (1. - source.a);
}

vec4 StarLayer(vec2 uv){
    vec4 col = vec4(0.);
    vec2 gv = fract(uv) - .5;
    vec2 id = floor(uv);

    for(int y=-1;y<=1;y++){
        for(int x=-1;x<=1;x++){
        vec2 offs = vec2(x,y);
        float n = Hash21(id + offs);
        float size = fract(n*44467.12);
        float rotate = fract(n*4345.44)*3.1415;
        vec2 starPos = gv-offs-vec2(n,fract(n*678.2313))+.5;
        vec2 offset = cos(iTime*n)*0.1*vec2(cos(n*PI*2.),sin(n*PI*2.));
        float star = Star(starPos+offset, n, smoothstep(.95,1.,size));
            vec4 color = vec4(sin(vec3(.2,.3,.9) * fract(n*1222.2) * 6.2831) * .5 + .5, 1.); 
        color *= vec4(.8, .1, .8,1.);
        star *= sin(3.*iTime+n*1232.23)*.5 + 1.5;
        col += star*size*color;
        }
    }   
    return col;
}


void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (fragCoord - .5 * iResolution.xy)/iResolution.y;
    vec4 col = vec4(.0);
    float t = iTime * .1;
    uv.x += 1. * t;
    
    vec3 c = vec3(uv.x, uv.y, 1.);

    vec3 cpos = 5.*pow(fbmslow(c*5.5),5.) * vec3(0.4, 0.5, 1.0) -.15;
    vec3 cpos1 = 10.0 * pow(fbmslow(c*0.5),5.0) * vec3(0.6, 0.3, 0.6) -.15;
    vec3 cpos2 = vec3(0.6, 0.0, 0.0) * 10.0 * pow((fbmslow(c*1.45 )), 5.0)-.15;

    col += vec4(cpos,1.);
    col += vec4(cpos1,1.);
    col += vec4(cpos2,1.);

    int count = 0;
    for(float i = 0.;i < 1.;i += 1./LAYERS){
        float depth = fract(i);
        float scale = mix(20., 5., depth);
        float fade = depth * smoothstep(1., .9, depth);
        if(count < 2){
            col += StarLayer(uv * scale + i * 422.1) * depth;
        }else if(count == 2){
            // vec2 uv1 = (uv0 - .5) * cc_screenSize.xy / cc_screenSize.y;
            // uv1.x += .368;
            // uv1.y += smoothstep(.1,.8,soundFrequency/2.);
            // float m = .02/length(uv1);
            // col += m*vec4(0.2,.3,.9,1.)*1.5;
            col = vec4(Blend(StarLayer(uv * scale + i * 422.1) * depth, col),1.);
        }else{
            col = vec4(Blend(StarLayer(uv * scale + i * 422.1) * depth, col),1.);
        }
        count++;
    }

    fragColor = col;
}

