//#region src/worker.ts
var e = !1, t = null, n = void 0;
async function r() {
	return e ||= (t = await import(new URL("./wasm/libimagequant_wasm.js", "" + import.meta.url).href), await t.default(n), !0), !0;
}
self.onmessage = async function(e) {
	let t = e.data;
	if ("type" in t && t.type === "configure") {
		n = t.wasmUrl;
		return;
	}
	let { id: o, action: s, data: c } = t;
	try {
		await r();
		let e;
		switch (s) {
			case "quantize_png":
				e = await i(c);
				break;
			case "quantize_imagedata":
				e = await a(c);
				break;
			default: throw Error(`Unknown action: ${s}`);
		}
		self.postMessage({
			id: o,
			success: !0,
			result: e
		});
	} catch (e) {
		self.postMessage({
			id: o,
			success: !1,
			error: e instanceof Error ? e.message : "Unknown error occurred"
		});
	}
};
async function i(e) {
	let { pngBytes: n, options: r = {} } = e, i = new Uint8Array(n), a = t.decode_png_to_rgba(i), s = a[0], c = a[1], l = a[2];
	return await o(s, c, l, r);
}
async function a(e) {
	let { imageData: t, width: n, height: r, options: i = {} } = e;
	return await o(new Uint8ClampedArray(t), n, r, i);
}
async function o(e, n, r, i) {
	let a = new t.ImageQuantizer();
	try {
		if (i.speed !== void 0 && a.setSpeed(i.speed), i.quality !== void 0) {
			let { min: e = 0, target: t = 100 } = i.quality;
			a.setQuality(e, t);
		}
		i.maxColors !== void 0 && a.setMaxColors(i.maxColors), i.posterization !== void 0 && a.setPosterization(i.posterization);
		let o = a.quantizeImage(e, n, r);
		try {
			let a = o.getPalette(), s = o.getQuantizationQuality(), c = o.getPaletteLength();
			i.dithering !== void 0 && o.setDithering(i.dithering);
			let l = o.getPaletteIndices(e, n, r), u = n * r, d = new Uint8ClampedArray(u * 4);
			for (let e = 0; e < u; e++) {
				let t = a[l[e]], n = e * 4;
				d[n] = t[0], d[n + 1] = t[1], d[n + 2] = t[2], d[n + 3] = t[3];
			}
			return {
				palette: a,
				pngBytes: t.encode_palette_to_png(l, a, n, r),
				imageData: new ImageData(d, n, r),
				quality: s,
				paletteLength: c,
				width: n,
				height: r
			};
		} finally {
			o.free();
		}
	} finally {
		a.free();
	}
}
self.postMessage({ type: "ready" });
//#endregion

//# sourceMappingURL=worker.mjs.map