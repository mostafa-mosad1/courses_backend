require('dotenv').config();
const pool = require('../src/config/db');
const bcrypt = require('bcryptjs');

function id(prefix, n) {
  return `${prefix}${String(n).padStart(6,'0')}`.slice(0,36);
}

async function seed() {
  try {
    console.log('Seeding database with fake data...');
    await pool.query('SET FOREIGN_KEY_CHECKS = 0');
    const tables = [
      'order_items','orders','coupons','wishlist','lesson_progress','enrollments',
      'attachments','lessons','sections','courses','categories','verification_tokens','users',
      'certificates','reviews','notifications','settings','contact_messages'
    ];
    for (const t of tables) await pool.query(`TRUNCATE TABLE \`${t}\``);
    await pool.query('SET FOREIGN_KEY_CHECKS = 1');

    const passwordHash = await bcrypt.hash('Secret123!', 10);

    // Users
    const users = [];
    users.push({ id: id('U',1), name: 'Mostafa', email: 'mostafa@example.com', role: 'ADMIN' });
    for (let i=2;i<=6;i++) users.push({ id: id('U',i), name: `Instructor${i}`, email: `inst${i}@example.com`, role: 'INSTRUCTOR' });
    for (let i=7;i<=20;i++) users.push({ id: id('U',i), name: `Student${i}`, email: `student${i}@example.com`, role: 'STUDENT' });

    for (const u of users) {
      await pool.query('INSERT INTO users (id,name,email,password,role,is_active,locale,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)', [u.id,u.name,u.email,passwordHash,u.role,1,'en',new Date(),new Date()]);
    }

    // Categories
    const categories = [
      { id: id('C',1), name: 'Programming', slug: 'programming' },
      { id: id('C',2), name: 'Design', slug: 'design' },
      { id: id('C',3), name: 'Business', slug: 'business' }
    ];
    for (const c of categories) await pool.query('INSERT INTO categories (id,name,slug,description,created_at,updated_at) VALUES (?,?,?,?,?,?)', [c.id,c.name,c.slug,`${c.name} courses`, new Date(), new Date()]);

    // Courses
    const courses = [];
    let ci = 1;
    for (const cat of categories) {
      for (let k=1;k<=3;k++) {
        const courseId = id('CO',ci++);
        const inst = users[(ci % 6)];
        courses.push({ id: courseId, title: `${cat.name} Course ${k}`, slug: `${cat.slug}-course-${k}`, category_id: cat.id, instructor_id: inst.id });
      }
    }
    for (const c of courses) await pool.query('INSERT INTO courses (id,title,slug,short_description,price,level,language,status,category_id,instructor_id,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)', [c.id,c.title,c.slug,`${c.title} short`, (Math.random()>0.5?0:29.99), 'BEGINNER','en','PUBLISHED',c.category_id,c.instructor_id,new Date(), new Date()]);

    // Sections & Lessons & Attachments
    let sec = 1; let les = 1; let att = 1;
    for (const course of courses) {
      const numSections = 2;
      for (let s=1;s<=numSections;s++) {
        const sectionId = id('S', sec++);
        await pool.query('INSERT INTO sections (id,course_id,title,sort_order,created_at,updated_at) VALUES (?,?,?,?,?,?)', [sectionId, course.id, `Section ${s}`, s-1, new Date(), new Date()]);
        for (let l=1;l<=3;l++) {
          const lessonId = id('L', les++);
          await pool.query('INSERT INTO lessons (id,section_id,title,type,content,video_url,duration,sort_order,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)', [lessonId, sectionId, `Lesson ${l}`, 'VIDEO', `Lesson ${l} content`, 'https://example.com/video.mp4', 120, l-1, new Date(), new Date()]);
          await pool.query('INSERT INTO attachments (id,lesson_id,name,url,size,mime_type,created_at) VALUES (?,?,?,?,?,?,?)', [id('A',att++), lessonId, `file-${l}.pdf`, 'https://example.com/file.pdf', 2048, 'application/pdf', new Date()]);
        }
      }
    }

    // Enrollments and lesson_progress
    let e = 1; let lp = 1;
    for (let uIndex=7; uIndex<=12; uIndex++) {
      const userId = id('U', uIndex);
      const course = courses[(uIndex-7) % courses.length];
      await pool.query('INSERT INTO enrollments (id,user_id,course_id,status,progress,enrolled_at) VALUES (?,?,?,?,?,?)', [id('E', e++), userId, course.id, 'ACTIVE', Math.floor(Math.random()*100), new Date()]);
      // some lesson progress
      for (let l=1;l<=2;l++) {
        await pool.query('INSERT INTO lesson_progress (id,user_id,lesson_id,is_completed,watched_seconds,completed_at,updated_at) VALUES (?,?,?,?,?,?,?)', [id('LP', lp++), userId, id('L', l), 0, l*30, null, new Date()]);
      }
    }

    // Coupons
    await pool.query('INSERT INTO coupons (id,code,type,value,max_uses,used_count,starts_at,expires_at,is_active,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)', [id('CP',1),'WELCOME10','PERCENT',10.00,100,0,new Date(),null,1,new Date()]);

    // Orders & Order items
    let o = 1; let oi = 1;
    for (let uIndex=7; uIndex<=8; uIndex++) {
      const orderId = id('O', o++);
      await pool.query('INSERT INTO orders (id,number,user_id,status,subtotal,discount,total,currency,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)', [orderId, `ORD-${orderId}`, id('U',uIndex), 'PAID', 29.99, 0, 29.99, 'USD', new Date(), new Date()]);
      await pool.query('INSERT INTO order_items (id,order_id,course_id,title,price) VALUES (?,?,?,?,?)', [id('OI', oi++), orderId, courses[0].id, courses[0].title, 29.99]);
    }

    // Reviews
    await pool.query('INSERT INTO reviews (id,user_id,course_id,rating,comment,is_approved,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)', [id('R',1), id('U',7), courses[0].id, 5, 'Excellent course', 1, new Date(), new Date()]);

    // Wishlist
    await pool.query('INSERT INTO wishlist (id,user_id,course_id,created_at) VALUES (?,?,?,?)', [id('W',1), id('U',8), courses[1].id, new Date()]);

    // Notifications
    await pool.query('INSERT INTO notifications (id,user_id,type,title,message,is_read,created_at) VALUES (?,?,?,?,?,?,?)', [id('N',1), id('U',7), 'SYSTEM', 'Welcome', 'Welcome to the platform', 0, new Date()]);

    // Settings
    await pool.query('INSERT INTO settings (`key`,value,updated_at) VALUES (?,?,?)', ['site:name', JSON.stringify({value:'LMS Demo'}), new Date()]);

    // Contact messages
    await pool.query('INSERT INTO contact_messages (id,name,email,subject,message,created_at) VALUES (?,?,?,?,?,?)', [id('CM',1), 'Visitor', 'visitor@example.com', 'Question', 'I have a question', new Date()]);

    // Verification tokens
    await pool.query('INSERT INTO verification_tokens (id,user_id,token,type,expires_at,created_at) VALUES (?,?,?,?,?,?)', [id('VT',1), id('U',7), 'verifytoken1', 'EMAIL_VERIFY', new Date(Date.now()+24*3600*1000), new Date()]);

    // Certificate
    await pool.query('INSERT INTO certificates (id,serial,user_id,course_id,file_url,issued_at) VALUES (?,?,?,?,?,?)', [id('CERT',1), 'CERT-1001', id('U',7), courses[0].id, 'https://example.com/cert.pdf', new Date()]);

    console.log('Seeding finished successfully.');
    process.exit(0);
  } catch (err) {
    console.error('Seeding failed:', err);
    process.exit(1);
  }
}

seed();
