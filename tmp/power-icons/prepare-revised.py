from PIL import Image, ImageOps, ImageDraw, ImageFont
from pathlib import Path
import numpy as np
out=Path('source-images/power-symbols/revised');out.mkdir(exist_ok=True)
masks={}
im=Image.open('tmp/power-icons/fool-icon.png').convert('RGBA')
masks['fool']=im.getchannel('A')
im=Image.open('tmp/power-icons/trickster.png').convert('RGB').crop((0,0,1000,940))
a=np.array(im).astype(float)
# Dark mask body; white background and facial openings become transparent.
v=np.clip((245-a.mean(axis=2))/194,0,1)
v[v<.04]=0
masks['trickster']=Image.fromarray((v*255).astype('uint8'))
im=Image.open('tmp/power-icons/seer.png').convert('RGB')
a=np.array(im).astype(float)
# Blue disk/pupil to white; neutral eye and baked checkerboard to alpha.
v=np.clip((a[:,:,2]-a[:,:,0]-12)/60,0,1)
v[v<.03]=0
masks['seer']=Image.fromarray((v*255).astype('uint8'))
im=Image.open('tmp/power-icons/wizard-staff.png').convert('RGB')
a=np.array(im).mean(axis=2)
v=np.clip((225-a)/210,0,1)
m=Image.fromarray((v*255).astype('uint8'));m=m.crop(m.getbbox())
masks['wizard']=m
for name,m in masks.items():
 m=m.crop(m.getbbox())
 size=(512,768) if name=='wizard' else (512,512)
 if name=='fool':
  m=m.resize((464,464),Image.Resampling.LANCZOS)
 scale=min((size[0]-48)/m.width,(size[1]-48)/m.height)
 m=m.resize((round(m.width*scale),round(m.height*scale)),Image.Resampling.LANCZOS)
 canvas=Image.new('RGBA',size,(255,255,255,0))
 white=Image.new('RGBA',m.size,(255,255,255,255));white.putalpha(m)
 canvas.alpha_composite(white,((size[0]-m.width)//2,(size[1]-m.height)//2))
 canvas.save(out/(name+'.png'))
 print(name,size,'symbol bounds',canvas.getchannel('A').getbbox())
# Dark preview sheet, including smaller intended display samples.
sheet=Image.new('RGB',(1120,720),'#202937');d=ImageDraw.Draw(sheet)
for i,name in enumerate(['wizard','fool','trickster','seer']):
 im=Image.open(out/(name+'.png')); im.thumbnail((230,450),Image.Resampling.LANCZOS)
 x=i*280+(280-im.width)//2; y=65+(450-im.height)//2
 sheet.paste(im,(x,y),im)
 d.text((i*280+95,25),name,fill='white')
 small=Image.open(out/(name+'.png'));small.thumbnail((40,60),Image.Resampling.LANCZOS)
 sheet.paste(small,(i*280+120,590),small)
sheet.save(out/'preview.png')
