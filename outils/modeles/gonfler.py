# Le FW-11 sort de Meshy aplati comme une pièce posée à plat. On le regonfle comme un coussin :
# l'avant et le dos s'écartent, beaucoup au milieu des panneaux, pas du tout sur le bord de la silhouette,
# là où les deux faces sont cousues.
# blender -b --python gonfler.py -- entree.glb sortie.glb [ecart]
import bpy, sys, numpy as np
argv = sys.argv[sys.argv.index('--') + 1:]
entree, sortie = argv[0], argv[1]
ECART = float(argv[2]) if len(argv) > 2 else .13
GRILLE = 256

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=entree)
objet = next(o for o in bpy.context.scene.objects if o.type == 'MESH')
mesh = objet.data
# l'import coupe le maillage à chaque couture d'UV : on recolle, sinon le lissage s'arrête aux coutures
bpy.context.view_layer.objects.active = objet; objet.select_set(True)
bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.mesh.remove_doubles(threshold=2.0)
bpy.ops.object.mode_set(mode='OBJECT')
co = np.empty(len(mesh.vertices) * 3); mesh.vertices.foreach_get('co', co); co = co.reshape(-1, 3)

# dans le maillage importé : x la largeur, z la hauteur, y l'épaisseur
mn, mx = co.min(0), co.max(0)
pas = max(mx[0] - mn[0], mx[2] - mn[2]) / (GRILLE - 4)
ix = ((co[:, 0] - mn[0]) / pas).astype(int) + 2
iz = ((co[:, 2] - mn[2]) / pas).astype(int) + 2

# la silhouette vue de face, refermée pour boucher les trous entre sommets
plein = np.zeros((GRILLE, GRILLE), bool)
plein[ix, iz] = True
def dilater(m):
    r = m.copy(); r[1:] |= m[:-1]; r[:-1] |= m[1:]; r[:, 1:] |= m[:, :-1]; r[:, :-1] |= m[:, 1:]; return r
def eroder(m): return ~dilater(~m)
for _ in range(2): plein = dilater(plein)
for _ in range(2): plein = eroder(plein)

# distance au bord de la silhouette (chanfrein 3-4, deux passes)
d = np.where(plein, 1e9, 0.0)
for i in range(1, GRILLE - 1):
    for j in range(1, GRILLE - 1):
        if plein[i, j]: d[i, j] = min(d[i, j], d[i-1, j] + 3, d[i, j-1] + 3, d[i-1, j-1] + 4, d[i-1, j+1] + 4)
for i in range(GRILLE - 2, 0, -1):
    for j in range(GRILLE - 2, 0, -1):
        if plein[i, j]: d[i, j] = min(d[i, j], d[i+1, j] + 3, d[i, j+1] + 3, d[i+1, j+1] + 4, d[i+1, j-1] + 4)
d = d / 3 * pas

# le plan moyen entre l'avant et le dos, case par case, lissé
somme = np.zeros((GRILLE, GRILLE)); nombre = np.zeros((GRILLE, GRILLE))
np.add.at(somme, (ix, iz), co[:, 1]); np.add.at(nombre, (ix, iz), 1)
milieu = np.where(nombre > 0, somme / np.maximum(nombre, 1), np.nan)
for _ in range(6):
    voisins = np.stack([np.roll(milieu, s, a) for s in (-1, 0, 1) for a in (0, 1)])
    milieu = np.where(np.isnan(milieu), np.nanmean(voisins, 0), milieu)
milieu = np.nan_to_num(milieu, nan=(mn[1] + mx[1]) / 2)

# profil en quart de cercle : la face monte vite près de la couture puis s'arrondit
rayon = .18 * (mx[0] - mn[0])
f = np.clip(d[ix, iz] / rayon, 0, 1)
profil = np.sqrt(1 - (1 - f) ** 2)
# le côté se lit d'abord à la normale ; là où elle est de biais (plis, bords), au plan moyen
normales = np.empty(len(co) * 3); mesh.vertices.foreach_get('normal', normales); ny = normales.reshape(-1, 3)[:, 1]
cote = np.where(np.abs(ny) > .25, np.sign(ny), np.sign(co[:, 1] - milieu[ix, iz]))
# les sommets importés sont des entiers : l'échelle est portée par l'objet
ecart = cote * ECART / objet.matrix_world.to_scale()[1] * profil
# lissé sur le maillage : un sommet mal classé suit ses voisins au lieu de partir en éclat
aretes = np.empty(len(mesh.edges) * 2, int); mesh.edges.foreach_get('vertices', aretes); aretes = aretes.reshape(-1, 2)
degre = np.bincount(aretes.ravel(), minlength=len(co)) + 1
for _ in range(30):
    somme = ecart.copy()
    np.add.at(somme, aretes[:, 0], ecart[aretes[:, 1]]); np.add.at(somme, aretes[:, 1], ecart[aretes[:, 0]])
    ecart = somme / degre
co[:, 1] += ecart

mesh.vertices.foreach_set('co', co.ravel())
bpy.context.view_layer.objects.active = objet; objet.select_set(True)
bpy.ops.mesh.customdata_custom_splitnormals_clear()
bpy.ops.object.shade_smooth()
mesh.update()
print('EPAISSEUR', round(float(co[:, 1].max() - co[:, 1].min()) * objet.matrix_world.to_scale()[1], 3))
bpy.ops.export_scene.gltf(filepath=sortie, export_format='GLB', export_image_format='WEBP', export_yup=True)
