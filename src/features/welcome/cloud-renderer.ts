import type { CloudCursorState, TextClearZone } from "./cloud.types";
import { FRAGMENT_SHADER_SOURCE, VERTEX_SHADER_SOURCE } from "./cloud-shader";

export interface CloudWebGLRenderer {
  render: (
    time: number,
    opacity: number,
    cursor: CloudCursorState,
    textClearZone: TextClearZone,
    actionZone: TextClearZone,
    pixelScale: number,
  ) => void;
  resize: (width: number, height: number) => void;
  destroy: () => void;
}

const compileShader = (
  gl: WebGL2RenderingContext,
  type: number,
  source: string,
): WebGLShader | null => {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
};

export const createCloudRenderer = (canvas: HTMLCanvasElement): CloudWebGLRenderer | null => {
  const gl = canvas.getContext("webgl2", { alpha: false, antialias: false });
  if (!gl) return null;

  const vertShader = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER_SOURCE);
  const fragShader = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER_SOURCE);
  if (!vertShader || !fragShader) return null;

  const program = gl.createProgram();
  if (!program) return null;
  gl.attachShader(program, vertShader);
  gl.attachShader(program, fragShader);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program);
    return null;
  }

  // Geometría de pantalla completa
  const quadBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
  const quadVerts = new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]);
  gl.bufferData(gl.ARRAY_BUFFER, quadVerts, gl.STATIC_DRAW);

  const posAttr = gl.getAttribLocation(program, "a_position");
  gl.enableVertexAttribArray(posAttr);
  gl.vertexAttribPointer(posAttr, 2, gl.FLOAT, false, 0, 0);

  // Localizaciones de uniforms
  const uTime = gl.getUniformLocation(program, "u_time");
  const uRes = gl.getUniformLocation(program, "u_resolution");
  const uCursor = gl.getUniformLocation(program, "u_cursor");
  const uCursorActive = gl.getUniformLocation(program, "u_cursorActive");
  const uBlueColor = gl.getUniformLocation(program, "u_blueColor");
  const uCloudOpacity = gl.getUniformLocation(program, "u_cloudOpacity");
  const uTextClearZone = gl.getUniformLocation(program, "u_textClearZone");
  const uActionZone = gl.getUniformLocation(program, "u_actionZone");
  const uPixelScale = gl.getUniformLocation(program, "u_pixelScale");

  let canvasWidth = canvas.width;
  let canvasHeight = canvas.height;

  // Azul cielo despejado (#1982e6 = [0.098, 0.510, 0.902])
  const blueR = 25 / 255;
  const blueG = 130 / 255;
  const blueB = 230 / 255;

  const resize = (width: number, height: number) => {
    canvasWidth = width;
    canvasHeight = height;
    gl.viewport(0, 0, width, height);
  };

  const render = (
    time: number,
    opacity: number,
    cursor: CloudCursorState,
    textClearZone: TextClearZone,
    actionZone: TextClearZone,
    pixelScale: number,
  ) => {
    gl.useProgram(program);
    gl.uniform1f(uTime, time);
    gl.uniform2f(uRes, canvasWidth, canvasHeight);
    gl.uniform2f(uCursor, cursor.x, canvasHeight - cursor.y);
    gl.uniform1f(uCursorActive, cursor.strength);
    gl.uniform3f(uBlueColor, blueR, blueG, blueB);
    gl.uniform1f(uCloudOpacity, opacity);
    gl.uniform4f(
      uTextClearZone,
      textClearZone[0],
      textClearZone[1],
      textClearZone[2],
      textClearZone[3],
    );
    gl.uniform4f(uActionZone, actionZone[0], actionZone[1], actionZone[2], actionZone[3]);
    gl.uniform1f(uPixelScale, pixelScale);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
  };

  const destroy = () => {
    gl.deleteBuffer(quadBuffer);
    gl.deleteProgram(program);
    gl.deleteShader(vertShader);
    gl.deleteShader(fragShader);
  };

  return { render, resize, destroy };
};
