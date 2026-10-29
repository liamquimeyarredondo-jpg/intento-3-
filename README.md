# Proyecto WebAR · cinco escenas

Plantilla de realidad aumentada para celular. La cámara reconoce un afiche impreso y superpone ilustraciones PNG con transparencia y textos que parecen flotar delante de él. La experiencia contiene cinco escenas y se avanza tocando el afiche. No incluye ilustraciones ni textos de muestra.

## Antes de empezar: qué es cada cosa

**Realidad aumentada (WebAR):** la cámara sigue mostrando el mundo real. Cuando reconoce el afiche, el proyecto agrega encima elementos digitales. No es realidad virtual: no reemplaza la cámara por un mundo completamente digital.

**MindAR:** analiza la cámara para reconocer el afiche. Necesita un archivo especial `.mind`, preparado a partir de la imagen exacta que se usará como referencia. No alcanza con guardar el afiche como PNG o JPG.

**A-Frame:** crea la escena 3D donde se ubican las ilustraciones y los textos. El proyecto usa sus coordenadas para que los elementos se mantengan en relación con el afiche aunque muevas el celular.

**PNG con transparencia:** es el formato recomendado para las ilustraciones porque permite que se vean únicamente los trazos y las formas, sin un rectángulo de fondo. El archivo debe ser un PNG real con canal alfa; cambiarle el nombre a un JPG no lo vuelve transparente.

**`config.json`:** contiene el contenido y los valores editables de las cinco escenas. Es el archivo principal para escribir textos y definir ubicación, tamaño, tipografía y animaciones.

**`editor.html`:** es una herramienta visual para modificar `config.json` sin editar el código de la experiencia. Permite mover los elementos arrastrando sus marcos, cambiar los valores mediante campos y descargar el JSON actualizado.

**`app.js`:** conecta todo: carga la configuración, inicia MindAR, cambia de escena al tocar el afiche y crea las imágenes/textos en el espacio aumentado.

**`styles.css`:** controla la interfaz que se dibuja sobre la pantalla, incluida la indicación pequeña de continuar. No aplica un fondo negro a toda la cámara.

## 1. Estructura de carpetas

```text
proyecto-webar/
├── index.html             Página de la experiencia para el celular
├── app.js                 Funcionamiento de la experiencia
├── styles.css             Apariencia de los avisos en pantalla
├── config.json            Textos, imágenes, posiciones y estilos
├── editor.html            Editor visual de la configuración
├── README.md              Este instructivo
├── targets/
│   └── LEEME.txt          Explica dónde poner el archivo .mind
└── assets/
    ├── images/
    │   └── LEEME.txt      Explica los nombres de los cinco PNG
    └── fonts/
        └── LEEME.txt      Información sobre tipografías personalizadas
```

Los archivos de ilustración y el archivo `poster.mind` no se incluyen porque deben corresponder a tu afiche y a tus dibujos reales. No hay imágenes de prueba.

## 2. Incorporar el reconocimiento del afiche

Este paso es obligatorio para que se active la cámara aumentada.

1. Buscá el archivo `.mind` que generaste anteriormente con el compilador de MindAR a partir del afiche definitivo.
2. Copialo dentro de la carpeta `targets` de este proyecto.
3. Cambiale el nombre exactamente a `poster.mind`.
4. La ruta final tiene que ser `targets/poster.mind`.

El `.mind` tiene que haberse generado a partir de la misma imagen del afiche que vas a imprimir o mostrar. Si cambiás mucho el diseño del afiche, probablemente debas volver a generar el archivo `.mind`.

## 3. Agregar las cinco ilustraciones

Guardá tus cinco ilustraciones en formato PNG, con el fondo transparente, dentro de `assets/images`. Usá estos nombres exactos:

| Escena | Nombre del archivo |
|---|---|
| 1 | `scene-01.png` |
| 2 | `scene-02.png` |
| 3 | `scene-03.png` |
| 4 | `scene-04.png` |
| 5 | `scene-05.png` |

No hace falta modificar `app.js` para cambiar los dibujos si conservás esos nombres. Si usás otros nombres o rutas, podés cambiar el campo **Ruta del PNG** en el editor visual.

Conviene exportar cada ilustración con un área de trabajo ajustada al dibujo, sin márgenes transparentes enormes, salvo que esos márgenes sean intencionales. El sistema conserva la transparencia. Por defecto, el ancho se controla en `config.json` y el alto se calcula automáticamente para conservar la proporción del PNG.

## 4. Escribir el texto y diseñar cada escena

### Opción recomendada: usar el editor visual

1. Abrí `editor.html` en una computadora, haciendo doble clic sobre el archivo.
2. Pulsá **Abrir config.json** y elegí el archivo `config.json` que está en la carpeta principal del proyecto.
3. Elegí la escena 1, 2, 3, 4 o 5.
4. Escribí el texto en el campo **Texto de la escena**. Un salto de línea en el campo crea un salto de línea en la escena.
5. Elegí la familia tipográfica, el grosor, el tamaño, el color, la alineación y el interlineado.
6. Escribí la ruta de la ilustración y ajustá ancho, alto, posición y profundidad.
7. También podés arrastrar los marcos de ilustración y texto en la vista previa para modificar X e Y.
8. Pulsá **Descargar config.json**. El navegador va a descargar un nuevo archivo con ese nombre.
9. Reemplazá el `config.json` del proyecto por el descargado. Conservá una copia de seguridad si querés guardar una versión anterior.

La vista previa es una guía de composición, no una simulación exacta de la cámara. Los marcos punteados que aparecen cuando faltan elementos existen solo dentro del editor; nunca aparecen en la experiencia WebAR.

### Opción manual: editar `config.json`

Podés abrirlo con un editor de texto, pero respetá la sintaxis JSON: comillas dobles, comas entre propiedades y llaves/corchetes balanceados. Un error de sintaxis puede impedir que se cargue la experiencia. Por eso, para empezar, es preferible el editor visual.

Cada escena tiene dos bloques principales:

- `image`: ruta del PNG, posición `x/y/z`, ancho, alto, opacidad, animación y duración.
- `text`: texto, posición, dimensiones del bloque, tipografía, tamaño, color, alineación, opacidad, animación y duración.

Las cinco escenas ya están creadas. Los campos de texto empiezan vacíos y las imágenes son rutas previstas para tus PNG; no hay contenido de muestra.

## 5. Entender la posición y el tamaño

El editor usa unidades relativas al afiche, no píxeles de pantalla. El ancho de referencia del afiche comienza en `1` unidad. El origen `(x=0, y=0)` es el centro del afiche.

- **X:** mueve el elemento a izquierda o derecha. Los valores positivos lo llevan a la derecha y los negativos a la izquierda.
- **Y:** mueve el elemento hacia arriba o abajo. Los valores positivos lo suben y los negativos lo bajan.
- **Z:** controla cuánto flota por delante del afiche. Un valor más alto lo acerca hacia la cámara en el sistema de coordenadas de la escena. Dejá una pequeña separación entre el afiche y los elementos para que no se superpongan con su superficie.
- **Ancho:** cambia el tamaño del elemento en relación con el ancho del afiche. Por ejemplo, un ancho `0.50` equivale a la mitad del ancho de referencia.
- **Alto de la imagen:** dejalo vacío para conservar automáticamente la proporción original del PNG. Indicá un número solamente si querés forzar una altura específica.
- **Ancho y alto del texto:** definen el rectángulo invisible donde se dibujan las letras. Si hay demasiado texto para ese espacio, puede quedar cortado; agrandá el bloque, bajá el cuerpo o dividí el texto en líneas.

Las medidas iniciales son solo un punto de partida técnico. Como todavía no están tus ilustraciones y textos, más adelante conviene ajustar cada escena mirando el resultado real en el celular.

## 6. Tipografía

El campo **Familia tipográfica** permite elegir una familia común del navegador, por ejemplo `Arial`, `Verdana`, `Georgia` o `Times New Roman`. El resultado depende de las fuentes disponibles en el dispositivo. Para usar una fuente especial en el celular sin depender de que esté instalada, el editor permite registrar un archivo de fuente web.

Para agregar una tipografía personalizada: copiá su archivo `.woff2` o `.woff` dentro de `assets/fonts`; en `editor.html`, abrí `config.json`; buscá el panel **Tipografías personalizadas**; escribí el nombre que quieras asignarle y la ruta completa desde la carpeta principal (por ejemplo `assets/fonts/mi-tipografia.woff2`); seleccioná el grosor y estilo correspondiente; pulsá **Agregar tipografía a la configuración** y descargá el `config.json`. Después elegí ese mismo nombre en **Familia tipográfica** para las escenas que lo necesiten. El archivo de fuente tiene que publicarse junto al proyecto y debe tener permisos de uso web. Si el archivo corresponde a una familia con varios grosores, cada archivo puede necesitar su propia entrada.

El tamaño tipográfico de la configuración se mide en píxeles de una textura interna que luego se coloca en el espacio AR. Por eso no equivale directamente al tamaño en píxeles del celular. La vista previa da una aproximación; el tamaño final se comprueba probándolo con el afiche real.

## 7. Animaciones disponibles

Las animaciones iniciales quedan configuradas como **Sin animación**, tal como decidimos, hasta ver qué ilustraciones y textos vas a usar. El editor ofrece cinco opciones genéricas:

- **Sin animación:** el elemento aparece en su posición final.
- **Aparecer gradualmente:** aumenta la opacidad.
- **Aparecer con escala:** entra desde un tamaño muy pequeño.
- **Subir y aparecer:** se desplaza desde abajo hasta su posición.
- **Flotar suavemente:** sube y baja de forma continua.

La duración se mide en milisegundos: `700` equivale a 0,7 segundos. Estas opciones son una base, no una decisión definitiva de dirección artística. Cuando estén tus dibujos y textos, podemos ajustar el movimiento de cada escena o crear una animación específica según lo que represente.

## 8. Cómo se avanza entre escenas

No hay botones grandes de anterior/siguiente. Cuando MindAR reconoce el afiche, se puede tocar el área del afiche en la pantalla del celular para avanzar a la escena siguiente. La indicación **“Pulse la imagen para continuar”** aparece discretamente abajo, sobre la cámara.

La escena 1 no puede retroceder y la escena 5 no avanza más allá del final. En la última se muestra **“Fin de la experiencia”**. Para volver a empezar, recargá la página del navegador.

El área tocable es un plano invisible que cubre la superficie virtual configurada como afiche. Si la proporción del afiche no coincide con la medida inicial, corregí el ancho y el alto en el editor para que la superficie táctil se corresponda mejor con el impreso.

## 9. Probar y publicar en el celular

Los navegadores móviles normalmente requieren una página servida por **HTTPS** para habilitar la cámara. Abrir `index.html` directamente desde el administrador de archivos no sirve para probar la cámara. El editor `editor.html`, en cambio, sí puede abrirse como archivo local para modificar la configuración.

Una forma gratuita de publicarlo es GitHub Pages:

1. Creá un repositorio en GitHub.
2. Subí el contenido de esta carpeta conservando la estructura, incluidas `assets` y `targets`.
3. Confirmá que estén presentes `config.json`, los cinco PNG y `targets/poster.mind`.
4. En la configuración del repositorio, buscá la sección **Pages** y activá la publicación desde la rama principal y la carpeta raíz del repositorio.
5. Abrí la dirección HTTPS que te entregue GitHub Pages desde el celular y permití el acceso a la cámara.
6. Mantené el teléfono en vertical y apuntá al mismo afiche usado para generar `poster.mind`.

Se necesita conexión a internet para cargar las bibliotecas de A-Frame y MindAR desde sus CDN, y para abrir la página publicada. No se incluye una copia local de esas bibliotecas en este ZIP.

## 10. Problemas frecuentes

**La cámara no aparece o se ve una pantalla vacía:** verificá que abras la página mediante HTTPS, aceptá el permiso de cámara y comprobá la conexión a internet. No abras `index.html` con doble clic para probar la experiencia.

**Aparece un aviso que falta `poster.mind`:** colocá el archivo compilado en `targets/poster.mind`. No lo reemplaces por la imagen PNG del afiche.

**La cámara aparece, pero no reconoce el afiche:** usá el afiche original, con buena luz, evitá reflejos y asegurate de que `poster.mind` fue compilado a partir de esa misma imagen. Los diseños con grandes zonas planas o pocos detalles pueden ser más difíciles de reconocer.

**No aparece una ilustración:** verificá que el archivo exista y que la ruta y las mayúsculas/minúsculas coincidan con `config.json`. Por ejemplo, `scene-01.png` no es lo mismo que `Scene-01.png` en muchos servidores.

**La ilustración o el texto es muy pequeño:** aumentá `width` en el editor. Para el texto también podés aumentar el tamaño tipográfico o el ancho/alto del bloque. La vista previa no reemplaza una prueba con el celular.

**El texto se corta:** agrandá el bloque, reducí el cuerpo o agregá saltos de línea. El fondo del texto es transparente; no se dibuja una caja detrás de las letras.

**Tocar el afiche no avanza:** asegurate de que el patrón esté reconocido y de tocar dentro de la superficie del afiche. Si hace falta, ajustá ancho/alto del afiche en el editor y volvé a publicar.

## 11. Qué archivos conviene modificar

| Lo que querés cambiar | Archivo o lugar |
|---|---|
| Cambiar textos, tipografía, posiciones, tamaños o animaciones | `editor.html` y exportar `config.json` |
| Cambiar las ilustraciones | Archivos de `assets/images` respetando sus nombres |
| Cambiar el mensaje pequeño inferior | Editor visual, sección “Textos de ayuda en pantalla” |
| Ajustar la apariencia del aviso inferior | `styles.css` |
| Modificar el funcionamiento de la cámara, el reconocimiento o la navegación | `app.js` |
| Cambiar el afiche que reconoce el sistema | Generar un nuevo `.mind` y reemplazar `targets/poster.mind` |

Para la primera versión, no hace falta cambiar `app.js` ni `index.html`. Completá los cinco PNG y los textos; después podemos revisar y afinar la composición y las animaciones con el material real.

## Documentación técnica

- [MindAR: instalación para A-Frame](https://hiukim.github.io/mind-ar-js-doc/installation/) — bibliotecas utilizadas y preparación de WebAR.
- [MindAR: eventos y detección de imágenes](https://hiukim.github.io/mind-ar-js-doc/examples/events-handling/) — eventos de reconocimiento y detección de toques sobre entidades.
- [A-Frame: documentación](https://aframe.io/docs/) — estructura de la escena 3D.


## Ajustes de esta versión

- **Cámara visible:** se fuerza el fondo transparente del renderer WebGL y se ajusta el orden de capas para que el vídeo de la cámara quede detrás de las ilustraciones y los textos.
- **Movimiento unificado:** las imágenes y los textos de las cinco escenas usan el movimiento suave de flotación de la escena 1. El ciclo ahora dura 6 segundos, cuatro veces más lento que antes. La amplitud del movimiento se mantiene.
- **Contraste de textos:** todos los textos se dibujan en blanco con un contorno negro fino, independientemente del color anterior guardado en la configuración.
- **Visibilidad:** se fuerza la opacidad del texto a 1 en las cinco escenas para evitar textos invisibles por una configuración previa.

Tras reemplazar los archivos en GitHub, esperá a que GitHub Pages termine de publicar y recargá la experiencia en el celular. Si el navegador conserva la versión anterior, cerrá la pestaña y volvé a abrir el enlace.
