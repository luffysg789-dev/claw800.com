const menuToggle = document.querySelector('#menuToggle');
const siteNav = document.querySelector('#siteNav');
const navLinks = [...document.querySelectorAll('.site-nav a')];
const sections = navLinks
  .map((link) => document.querySelector(link.getAttribute('href')))
  .filter(Boolean);
const langButtons = [...document.querySelectorAll('[data-lang-switcher] button')];
const galleryButtons = [...document.querySelectorAll('[data-gallery-index]')];
const galleryLightbox = document.querySelector('#galleryLightbox');
const lightboxImage = document.querySelector('.lightbox-image');
const lightboxCount = document.querySelector('#lightboxCount');
const lightboxClose = document.querySelector('.lightbox-close');
const lightboxNext = document.querySelector('.lightbox-nav.next');
const lightboxPrev = document.querySelector('.lightbox-nav.prev');
const galleryImages = galleryButtons.map((button) => {
  const image = button.querySelector('img');
  return {
    alt: image?.alt || 'Project image',
    src: image?.src || '',
  };
});
let activeGalleryIndex = 0;
const translations = {
  th: {
    'nav.about': 'เกี่ยวกับเรา',
    'nav.work': 'ผลงาน',
    'nav.services': 'บริการ',
    'nav.process': 'ขั้นตอน',
    'nav.contact': 'ติดต่อ',
    'hero.eyebrow': 'พาร์ทเนอร์ไลฟ์คอมเมิร์ซและการเติบโตดิจิทัลในประเทศไทย',
    'hero.title': 'เปลี่ยนไลฟ์ คอนเทนต์ และอีเวนต์ ให้เป็นยอดขายจริง',
    'hero.text': 'แพนด้าด็อก ไทยแลนด์ ช่วยแบรนด์วางแผน ผลิต ดำเนินรายการ และปรับประสบการณ์การขายให้เฉียบคม น่าเชื่อถือ และพร้อมสร้างยอดขาย',
    'hero.cta': 'ติดต่อเรา',
    'hero.secondaryCta': 'ดูบริการ',
    'hero.proofLineOne': 'กลยุทธ์ พิธีกร สตูดิโอ และรายงานผล อยู่ในทีมเดียว',
    'hero.proofLineTwo': 'ดูแลไลฟ์ · ไลฟ์คอมเมิร์ซ · ออนไลน์สู่ออฟไลน์ · ผลิตคอนเทนต์สร้างสรรค์',
    'metric.services': 'บริการหลัก',
    'metric.o2o': 'ออนไลน์สู่ออฟไลน์',
    'metric.production': 'ซัพพอร์ตงานผลิต',
    'logos.label': 'ได้รับความไว้วางใจในการดำเนินแคมเปญ',
    'video.eyebrow': 'วิดีโอผลงาน',
    'video.title': 'วิดีโอไลฟ์คอมเมิร์ซจากเว็บไซต์เดิม ถูกจัดวางใหม่ให้เป็นหลักฐานความเชี่ยวชาญ',
    'about.eyebrow': 'เกี่ยวกับเรา',
    'about.title': 'มากกว่าเอเจนซี่ คือพาร์ทเนอร์เพื่อการเติบโตของไลฟ์คอมเมิร์ซ',
    'about.whoTitle': 'เราเป็นใคร',
    'about.whoText': '"มากกว่าเอเจนซี่ คือเพื่อนคู่คิดที่เชี่ยวชาญด้านไลฟ์คอมเมิร์ซและการตลาดดิจิทัล" แพนด้าด็อก ไทยแลนด์ คือทีมงานมืออาชีพที่พร้อมขับเคลื่อนธุรกิจของคุณด้วยกลยุทธ์ที่ชาญฉลาด และการสร้างประสบการณ์ไลฟ์สตรีมมิงแบบออนไลน์สู่ออฟไลน์',
    'about.visionTitle': 'วิสัยทัศน์',
    'about.visionText': 'มุ่งสู่การเป็นพันธมิตรทางการตลาดที่แบรนด์ไว้วางใจ สร้างการเติบโตที่ยั่งยืนทั้งออนไลน์และออฟไลน์',
    'about.whyTitle': 'ทำไมต้องเลือกเรา',
    'about.whyText': 'ประสบการณ์ ความเชี่ยวชาญ โซลูชันที่ออกแบบเฉพาะ และผลลัพธ์ที่โปร่งใส เราไม่ได้ทำหน้าที่แค่ "เพิ่มยอดขาย" แต่ช่วยสร้างแบรนด์ให้มีตัวตน แข็งแกร่ง และเข้าไปนั่งในใจลูกค้า',
    'about.missionStrategy': 'กลยุทธ์แม่นยำ: ออกแบบกลยุทธ์ที่ตอบโจทย์ยอดขายและวัดผลได้จริง',
    'about.missionConnection': 'เชื่อมต่ออย่างลึกซึ้ง: เชื่อมต่อแบรนด์กับลูกค้าผ่านคอนเทนต์คุณภาพ',
    'about.missionDelivery': 'ส่งมอบอย่างมืออาชีพ: ทำงานยืดหยุ่น ใส่ใจรายละเอียด และมุ่งผลลัพธ์ที่ดีขึ้น',
    'work.eyebrow': 'ผลงานของเรา',
    'work.title': 'รูปแบบแคมเปญที่สร้างความสนใจ ความเชื่อมั่น และการลงมือซื้อ',
    'work.live.label': 'ไลฟ์คอมเมิร์ซ',
    'work.live.title': 'การขายแบบเรียลไทม์พร้อมพิธีกรมืออาชีพและทีมผลิตครบวงจร',
    'work.content.label': 'คอนเทนต์แบรนด์',
    'work.content.title': 'เล่าเรื่องสินค้าให้คมขึ้นสำหรับโซเชียลและช่องทางการขาย',
    'work.activities.label': 'กิจกรรม',
    'work.activities.title': 'กิจกรรมภาคสนามที่เปลี่ยนการรับรู้ให้เป็นความทรงจำต่อแบรนด์',
    'work.activities.text': 'ออกแบบเพื่อการมีส่วนร่วมโดยตรง การทดลองสินค้า การเปิดตัว และกิจกรรมหน้าร้าน',
    'services.eyebrow': 'บริการ',
    'services.title': 'ครบทุกสิ่งที่แบรนด์ต้องใช้เพื่อวางแผน ผลิต และขายผ่านไลฟ์',
    'services.event.title': 'กิจกรรมและการลงพื้นที่',
    'services.event.text': 'ไม่เพียงแค่การทำการตลาดออนไลน์ เรายังช่วยแบรนด์สร้างประสบการณ์ที่น่าจดจำผ่านกิจกรรมที่เข้าถึงลูกค้าโดยตรงและสร้างการมีส่วนร่วมได้จริง.',
    'services.live.title': 'โซลูชันไลฟ์คอมเมิร์ซ',
    'services.live.text': 'ใช้แพลตฟอร์มไลฟ์คอมเมิร์ซเพื่อขับเคลื่อนการขายแบบเรียลไทม์ ด้วยกลยุทธ์ที่แม่นยำ การนำเสนอสินค้าที่น่าสนใจ และการมีส่วนร่วมจากกลุ่มเป้าหมาย',
    'services.creative.title': 'ผลิตคอนเทนต์สร้างสรรค์',
    'services.creative.text': 'ผลิตวิดีโอ โฆษณาออนไลน์ ภาพสินค้า และกราฟิกที่สื่อสารภาพลักษณ์ของแบรนด์ได้อย่างโดดเด่นและตรงกับกลุ่มเป้าหมาย.',
    'services.kol.title': 'จัดการพิธีกรและอินฟลูเอนเซอร์',
    'services.kol.text': 'จัดการพิธีกรและอินฟลูเอนเซอร์ที่เหมาะกับแบรนด์ เพิ่มความน่าเชื่อถือ ขยายการเข้าถึง และทำให้การสื่อสารกับลูกค้าเกิดผลลัพธ์ที่ดีที่สุด',
    'services.studio.title': 'บริการเช่าสตูดิโอ',
    'services.studio.text': 'เช่าสตูดิโอสำหรับไลฟ์สตรีมมิง ถ่ายภาพสินค้า และวิดีโอโปรโมท พร้อมไฟ กล้อง จอมอนิเตอร์ ฉาก พร็อพ อินเทอร์เน็ต และพื้นที่ทำงานครบวงจร',
    'process.eyebrow': 'ขั้นตอน',
    'process.title': 'จังหวะการทำงานชัดเจน ตั้งแต่บรีฟจนถึงรีวิวผลลัพธ์',
    'process.strategy.title': 'วางกลยุทธ์',
    'process.strategy.text': 'กำหนดกลุ่มเป้าหมาย ข้อเสนอ แพลตฟอร์ม มุมเล่าเรื่อง และเป้าหมายยอดขาย',
    'process.production.title': 'ผลิตงาน',
    'process.production.text': 'เตรียมสคริปต์ ภาพสินค้า สตูดิโอ พิธีกร และแอสเซ็ตสำหรับแคมเปญ',
    'process.operation.title': 'ดำเนินไลฟ์',
    'process.operation.text': 'รันไลฟ์ด้วยพลังของพิธีกร การตอบโต้ลูกค้า และการประสานงานแบบเรียลไทม์',
    'process.reporting.title': 'รายงานผล',
    'process.reporting.text': 'ทบทวนผลลัพธ์และเปลี่ยนบทเรียนเป็นแอ็กชันการเติบโตครั้งต่อไป',
    'testimonials.eyebrow': 'รีวิวจากลูกค้า',
    'testimonials.title': 'ลูกค้าไว้วางใจทีมจากความมั่นใจ พลังงาน และโฟกัสด้านยอดขาย',
    'testimonial.one.quote': 'ทีมงานไลฟ์สดมืออาชีพมาก พูดเก่ง ปิดการขายเก่ง ยอดพุ่งตั้งแต่วันแรกเลยครับ',
    'testimonial.one.name': 'คุณวริศรา ทองใบ',
    'testimonial.one.role': 'เจ้าของแบรนด์เสื้อผ้าแฟชั่น',
    'testimonial.two.quote': 'จ้างทีมนี้มาไลฟ์แทน ไม่ผิดหวังเลย ไลฟ์กระตุ้นยอดดี ลูกค้าอินบ็อกซ์เข้ารัวๆ',
    'testimonial.two.name': 'ธนกฤต อัครเมธากุล',
    'testimonial.two.role': 'เจ้าของร้านออนไลน์',
    'testimonial.three.quote': 'ประทับใจมากครับ ทีมพูดคล่อง โปรไฟล์ดี ทำให้แบรนด์เราดูน่าเชื่อถือขึ้นเยอะเลย',
    'testimonial.three.name': 'ศราวุธ นาคสุวรรณ',
    'testimonial.three.role': 'เจ้าของแบรนด์อาหารเสริม',
    'contact.eyebrow': 'ติดต่อ',
    'contact.title': 'พร้อมวางแผนแคมเปญไลฟ์คอมเมิร์ซครั้งต่อไปหรือยัง?',
    'contact.text': 'ติดต่อเราได้เลย ทีมงานพร้อมช่วยออกแบบแคมเปญที่เหมาะกับแบรนด์และกลุ่มเป้าหมายของคุณ',
    'contact.phone': 'โทร. 0808218956',
    'contact.address': '1531 ทาวน์อินทาวน์ ซอย 3/1 แขวงพลับพลา เขตวังทองหลาง กรุงเทพมหานคร 10310',
    'contact.qrText': 'หากมีคำถามใดๆ กรุณาติดต่อเรา',
    'contact.qrCta': 'ติดต่อทันที',
    'form.name': 'ชื่อ',
    'form.phone': 'โทรศัพท์หรือไลน์',
    'form.service': 'ประเภทแคมเปญ',
    'form.message': 'ข้อความ',
    'form.submit': 'ส่งข้อความ',
    'form.success': 'ขอบคุณ {name} ทีมงานจะติดต่อกลับเร็วๆ นี้',
    'form.successFallback': 'ขอบคุณ ทีมงานจะติดต่อกลับเร็วๆ นี้',
    'footer.copyright': '© 2026 บริษัท อีมาน อินดัสเทรียล (ประเทศไทย) จำกัด สงวนลิขสิทธิ์',
  },
  en: {
    'nav.about': 'About',
    'nav.work': 'Work',
    'nav.services': 'Services',
    'nav.process': 'Process',
    'nav.contact': 'Contact',
    'hero.eyebrow': 'Live Commerce & Digital Growth Partner in Thailand',
    'hero.title': 'Turn live, content, and activation into measurable sales growth.',
    'hero.text': 'Panda Dog Thailand helps brands plan, produce, host, and optimize commerce experiences that feel sharp, credible, and conversion ready.',
    'hero.cta': 'Contact Now',
    'hero.secondaryCta': 'View Services',
    'hero.proofLineOne': 'Strategy, MC, studio, and reporting in one team.',
    'hero.proofLineTwo': 'Live Operation · Live Commerce · O2O · Creative Production',
    'metric.services': 'Core services',
    'metric.o2o': 'Online to offline',
    'metric.production': 'Production support',
    'logos.label': 'Trusted for campaign execution',
    'video.eyebrow': 'Showreel',
    'video.title': 'Original live commerce video, reframed as proof of capability.',
    'about.eyebrow': 'About Us',
    'about.title': 'More than an agency, a partner for live commerce growth.',
    'about.whoTitle': 'Who We Are',
    'about.whoText': '"More than an agency, a thinking partner specializing in Live Commerce and digital marketing." Panda Dog Thailand is a professional team that drives brands with smart strategy and O2O live streaming experiences.',
    'about.visionTitle': 'Vision',
    'about.visionText': 'To become the marketing partner brands trust for sustainable growth across online and offline channels.',
    'about.whyTitle': 'Why Choose Us',
    'about.whyText': 'Experience & Expertise, Tailor-Made Solutions, and Transparent Results. We do more than increase sales; we help brands become memorable and trusted.',
    'about.missionStrategy': 'Strategic Precision: Design precise strategies that answer sales goals and can be measured.',
    'about.missionConnection': 'Deep Connection: Connect brands with customers through quality content and powerful communication.',
    'about.missionDelivery': 'Excellence Delivery: Deliver professional, flexible, detail-focused work for stronger outcomes.',
    'work.eyebrow': 'Our Work',
    'work.title': 'Campaign formats built for attention, trust, and action.',
    'work.live.label': 'Live Commerce',
    'work.live.title': 'Real-time selling with professional hosts and production support.',
    'work.content.label': 'Brand Content',
    'work.content.title': 'Sharper product stories for social and commerce channels.',
    'work.activities.label': 'Activities',
    'work.activities.title': 'On-ground activation that turns awareness into brand memory.',
    'work.activities.text': 'Designed for direct customer engagement, sampling, product launches, and retail events.',
    'services.eyebrow': 'Services',
    'services.title': 'Everything a brand needs to plan, produce, and sell live.',
    'services.event.title': 'Event & On-Ground Activation',
    'services.event.text': 'Beyond online marketing, we help brands create memorable on-ground experiences that reach customers directly and drive real engagement.',
    'services.live.title': 'Live Commerce Solution',
    'services.live.text': 'Live commerce support for real-time selling through precise strategy, compelling product presentation, and audience engagement.',
    'services.creative.title': 'Creative Production',
    'services.creative.text': 'Video, online ads, product photography, and graphic assets that communicate the brand clearly and creatively.',
    'services.kol.title': 'MC & KOL Management',
    'services.kol.text': 'MC and KOL management matched to the brand, audience, and campaign goals to build trust and expand reach.',
    'services.studio.title': 'Studio Rental Service',
    'services.studio.text': 'Live streaming and content studio rental with lighting, camera support, monitors, sets, props, internet, and workspace.',
    'process.eyebrow': 'Process',
    'process.title': 'A clear operating rhythm from brief to performance review.',
    'process.strategy.title': 'Strategy',
    'process.strategy.text': 'Define audience, offer, platform, story angle, and sales objective.',
    'process.production.title': 'Production',
    'process.production.text': 'Prepare scripts, visuals, products, studio setup, hosts, and campaign assets.',
    'process.operation.title': 'Live Operation',
    'process.operation.text': 'Run the live session with MC energy, customer interaction, and real-time coordination.',
    'process.reporting.title': 'Reporting',
    'process.reporting.text': 'Review campaign results and turn learnings into the next growth action.',
    'testimonials.eyebrow': 'Testimonials',
    'testimonials.title': 'Clients value the team for confidence, energy, and sales focus.',
    'testimonial.one.quote': 'The live team was very professional. They spoke well, closed sales smoothly, and sales jumped from the first day.',
    'testimonial.one.name': 'Warisara Tongbai',
    'testimonial.one.role': 'Fashion brand owner',
    'testimonial.two.quote': 'Hiring this team to host our live session was worth it. The live boosted sales and customers messaged us nonstop.',
    'testimonial.two.name': 'Thanakrit Akkharamethakul',
    'testimonial.two.role': 'Online store owner',
    'testimonial.three.quote': 'Very impressed. The team speaks fluently and looks professional, making our brand feel much more credible.',
    'testimonial.three.name': 'Sarawut Naksuwan',
    'testimonial.three.role': 'Supplement brand owner',
    'contact.eyebrow': 'Contact',
    'contact.title': 'Ready to plan your next live commerce campaign?',
    'contact.text': 'Please get in touch with us. Our team can help design a campaign for your brand and audience.',
    'contact.phone': 'Tel. 0808218956',
    'contact.address': '1531 Town In Town Soi 3/1',
    'contact.qrText': 'If you have any questions, please contact us.',
    'contact.qrCta': 'Contact Now',
    'form.name': 'Name',
    'form.phone': 'Phone or LINE',
    'form.service': 'Campaign Type',
    'form.message': 'Message',
    'form.submit': 'Send Inquiry',
    'form.success': 'Thank you, {name}. Our team will contact you soon.',
    'form.successFallback': 'Thank you. Our team will contact you soon.',
    'footer.copyright': '© 2026 IMAN INDUSTRIAL (THAILAND) CO., LTD. All rights reserved.',
  },
  zh: {
    'nav.about': '关于我们',
    'nav.work': '案例',
    'nav.services': '服务',
    'nav.process': '流程',
    'nav.contact': '联系',
    'hero.eyebrow': '泰国直播电商与数字增长伙伴',
    'hero.title': '把直播、内容和活动，变成销售增长。',
    'hero.text': 'Panda Dog Thailand 帮助品牌完成策略、制作、主持、直播运营与复盘，让电商体验更专业、更可信、更能转化。',
    'hero.cta': '立即联系',
    'hero.secondaryCta': '查看服务',
    'hero.proofLineOne': '策略、MC、摄影棚与数据复盘，由同一团队统筹',
    'hero.proofLineTwo': '直播运营·直播电商 · O2O · 创意制作',
    'metric.services': '核心服务',
    'metric.o2o': '线上到线下',
    'metric.production': '制作支持',
    'logos.label': '为品牌执行增长型活动',
    'video.eyebrow': '作品视频',
    'video.title': '保留原官网直播电商视频，并以更专业的方式展示能力。',
    'about.eyebrow': '关于我们',
    'about.title': '不只是代理机构，更是直播电商增长伙伴。',
    'about.whoTitle': '我们是谁',
    'about.whoText': 'Panda Dog Thailand 是专注直播电商与数字营销的专业团队，帮助品牌用清晰策略、创意内容和 O2O 体验推动业务增长。',
    'about.visionTitle': '愿景',
    'about.visionText': '成为品牌信赖的营销伙伴，在线上和线下持续创造可衡量、可复用的增长。',
    'about.whyTitle': '为什么选择我们',
    'about.whyText': '我们拥有实战经验、定制化方案和透明结果。不只是提升销量，也帮助品牌建立更强的存在感和信任感。',
    'about.missionStrategy': '精准策略：设计可衡量、能回应销售目标的活动策略。',
    'about.missionConnection': '深度连接：通过优质内容和有力量的沟通连接品牌与客户。',
    'about.missionDelivery': '专业交付：以灵活、细致、专业的执行保障活动成果。',
    'work.eyebrow': '案例展示',
    'work.title': '围绕注意力、信任和行动设计的活动形式。',
    'work.live.label': '直播电商',
    'work.live.title': '由专业主持与制作团队支持的实时销售现场。',
    'work.content.label': '品牌内容',
    'work.content.title': '为社交媒体与电商渠道打造更清晰的产品故事。',
    'work.activities.label': '线下活动',
    'work.activities.title': '把品牌曝光转化为真实记忆点的线下执行。',
    'work.activities.text': '适合客户互动、试用体验、新品发布和零售场景活动。',
    'services.eyebrow': '服务',
    'services.title': '从策划、制作到直播销售，品牌需要的能力都在这里。',
    'services.event.title': '活动与线下执行',
    'services.event.text': '不只做线上营销，也为品牌打造能直接触达客户、产生参与感和记忆点的线下活动体验。',
    'services.live.title': '直播电商解决方案',
    'services.live.text': '围绕实时销售提供直播电商支持，包括策略、产品呈现、主持节奏和观众互动。',
    'services.creative.title': '创意内容制作',
    'services.creative.text': '制作视频、线上广告、产品摄影和视觉素材，让品牌信息更清晰、更有吸引力。',
    'services.kol.title': '主持人与 KOL 管理',
    'services.kol.text': '根据品牌、受众和活动目标匹配主持人和 KOL，提升信任感并扩大触达。',
    'services.studio.title': '直播棚租赁服务',
    'services.studio.text': '提供直播与内容拍摄空间，配备灯光、相机支持、监看屏、场景、道具、网络和工作区。',
    'process.eyebrow': '流程',
    'process.title': '从需求简报到效果复盘，工作节奏清晰可控。',
    'process.strategy.title': '策略规划',
    'process.strategy.text': '明确目标人群、销售主张、平台选择、内容角度和销售目标。',
    'process.production.title': '内容制作',
    'process.production.text': '准备脚本、视觉素材、产品、直播间搭建、主持人与活动资产。',
    'process.operation.title': '直播运营',
    'process.operation.text': '用主持节奏、客户互动和实时协调推动直播现场表现。',
    'process.reporting.title': '效果复盘',
    'process.reporting.text': '复盘活动结果，把经验转化为下一次增长动作。',
    'testimonials.eyebrow': '客户评价',
    'testimonials.title': '客户看重团队的表现力、专业感和销售意识。',
    'testimonial.one.quote': '直播团队非常专业，表达流畅，也很会带动成交，第一天销售表现就明显提升。',
    'testimonial.one.name': 'Warisara Tongbai',
    'testimonial.one.role': '服装品牌负责人',
    'testimonial.two.quote': '请他们代播没有失望，直播有效拉动销量，客户私信也明显增加。',
    'testimonial.two.name': 'Thanakrit Akkharamethakul',
    'testimonial.two.role': '线上店铺负责人',
    'testimonial.three.quote': '非常满意，团队表达自然、形象专业，让我们的品牌可信度提升很多。',
    'testimonial.three.name': 'Sarawut Naksuwan',
    'testimonial.three.role': '保健品品牌负责人',
    'contact.eyebrow': '联系我们',
    'contact.title': '准备规划下一场直播电商活动了吗？',
    'contact.text': '欢迎联系我们。团队可以根据品牌、产品和目标人群设计合适的活动方案。',
    'contact.phone': '电话 0808218956',
    'contact.address': '1531 Town In Town Soi 3/1',
    'contact.qrText': '如有任何疑问，请联系我们。',
    'contact.qrCta': '立即联系',
    'form.name': '姓名',
    'form.phone': '电话或 LINE',
    'form.service': '活动类型',
    'form.message': '留言',
    'form.submit': '提交咨询',
    'form.success': '谢谢 {name}，我们的团队会尽快联系你。',
    'form.successFallback': '谢谢，我们的团队会尽快联系你。',
    'footer.copyright': '© 2026 IMAN INDUSTRIAL（泰国）有限公司 版权所有',
  },
};

let currentLanguage = localStorage.getItem('siteLanguage') || 'en';

function applyLanguage(language) {
  const dictionary = translations[language] || translations.th;
  currentLanguage = translations[language] ? language : 'en';
  document.documentElement.lang = currentLanguage;

  document.querySelectorAll('[data-i18n]').forEach((element) => {
    const key = element.dataset.i18n;
    if (dictionary[key]) {
      element.textContent = dictionary[key];
    }
  });

  langButtons.forEach((button) => {
    button.classList.toggle('active', button.dataset.lang === currentLanguage);
  });

  localStorage.setItem('siteLanguage', currentLanguage);
}

function showLightboxImage(index) {
  if (!galleryImages.length || !lightboxImage || !lightboxCount) {
    return;
  }

  activeGalleryIndex = (index + galleryImages.length) % galleryImages.length;
  const image = galleryImages[activeGalleryIndex];
  lightboxImage.src = image.src;
  lightboxImage.alt = image.alt;
  lightboxCount.textContent = `${activeGalleryIndex + 1} / ${galleryImages.length}`;
}

function openLightbox(index) {
  if (!galleryLightbox) {
    return;
  }

  showLightboxImage(index);
  galleryLightbox.classList.add('open');
  galleryLightbox.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}

function closeLightbox() {
  if (!galleryLightbox) {
    return;
  }

  galleryLightbox.classList.remove('open');
  galleryLightbox.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}

function nextImage() {
  showLightboxImage(activeGalleryIndex + 1);
}

function prevImage() {
  showLightboxImage(activeGalleryIndex - 1);
}

menuToggle?.addEventListener('click', () => {
  const isOpen = siteNav.classList.toggle('open');
  menuToggle.setAttribute('aria-expanded', String(isOpen));
});

navLinks.forEach((link) => {
  link.addEventListener('click', () => {
    siteNav.classList.remove('open');
    menuToggle?.setAttribute('aria-expanded', 'false');
  });
});

const setActiveNav = () => {
  const current = sections.findLast((section) => section.getBoundingClientRect().top <= 140) || sections[0];

  navLinks.forEach((link) => {
    link.classList.toggle('active', link.getAttribute('href') === `#${current.id}`);
  });
};

window.addEventListener('scroll', setActiveNav, { passive: true });
window.addEventListener('load', setActiveNav);

langButtons.forEach((button) => {
  button.addEventListener('click', () => {
    applyLanguage(button.dataset.lang);
  });
});

galleryButtons.forEach((button) => {
  button.addEventListener('click', () => {
    openLightbox(Number(button.dataset.galleryIndex || 0));
  });
});

lightboxClose?.addEventListener('click', closeLightbox);
lightboxNext?.addEventListener('click', nextImage);
lightboxPrev?.addEventListener('click', prevImage);

galleryLightbox?.addEventListener('click', (event) => {
  if (event.target === galleryLightbox) {
    closeLightbox();
  }
});

document.addEventListener('keydown', (event) => {
  if (!galleryLightbox?.classList.contains('open')) {
    return;
  }

  if (event.key === 'Escape') {
    closeLightbox();
  }

  if (event.key === 'ArrowRight') {
    nextImage();
  }

  if (event.key === 'ArrowLeft') {
    prevImage();
  }
});

function initHeroVideoVolume() {
  if (!document.querySelector('#heroVideo')) {
    return;
  }

  const playWithVolume = (player) => {
    player.setVolume(50);
    player.unMute();
    player.playVideo();
  };

  const armSoundAfterInteraction = (player) => {
    const enableSound = () => {
      playWithVolume(player);
    };
    ['pointerdown', 'touchstart', 'keydown', 'wheel', 'scroll'].forEach((eventName) => {
      window.addEventListener(eventName, enableSound, { once: true, passive: true });
    });
  };

  window.onYouTubeIframeAPIReady = () => {
    const player = new YT.Player('heroVideo', {
      events: {
        onReady: (event) => {
          event.target.setVolume(50);
          event.target.playVideo();
          armSoundAfterInteraction(event.target);

          window.setTimeout(() => {
            playWithVolume(event.target);
          }, 800);
        },
      },
    });
    window.heroVideoPlayer = player;
  };

  const script = document.createElement('script');
  script.src = 'https://www.youtube.com/iframe_api';
  document.head.append(script);
}

initHeroVideoVolume();
applyLanguage(currentLanguage);
