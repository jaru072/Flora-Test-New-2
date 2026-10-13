const fs = require('fs');

let html = fs.readFileSync('org_chart.html', 'utf8');

// Replace the hardcoded headCentral, headRoseExp, headRattanabuppha, headDhammayatra matchers
const oldPillarsBlock = `      // Section Heads for 4 Main Pillars (หัวหน้าส่วนงานทั้ง 4 - ต้องไม่เป็นบุคลากรรอลงผัง และให้สิทธิ์วางตำแหน่งก่อน)
      const headCentral = list.find(e => {
        if (isUnassigned(e)) return false;
        const eid = String(e.id || e.code);
        if (placedEmployeeIds.has(eid)) return false;
        const pos = e.position || '';
        const dept = e.department || '';
        const posNode = e.positionNodeId || '';
        const deptNode = e.departmentNodeId || '';
        return (
          posNode === 'pos-4-1' ||
          pos === '4.1 หัวหน้างานส่วนกลาง' || 
          pos === 'หัวหน้างานส่วนกลาง' || 
          pos.includes('หัวหน้างานส่วนกลาง') ||
          (deptNode === 'division-1' && pos.includes('หัวหน้า') && !posNode.startsWith('pos-5-')) ||
          (dept.includes('งานส่วนกลาง') && pos.includes('หัวหน้า') && !pos.includes('1.1') && !pos.includes('1.2') && !pos.includes('1.3') && !pos.includes('1.4') && !posNode.startsWith('pos-5-'))
        );
      }) || null;
      if (headCentral) markPlaced(headCentral);

      const headRoseExp = list.find(e => {
        if (isUnassigned(e)) return false;
        const eid = String(e.id || e.code);
        if (placedEmployeeIds.has(eid)) return false;
        const pos = e.position || '';
        const dept = e.department || '';
        const posNode = e.positionNodeId || '';
        const deptNode = e.departmentNodeId || '';
        return (
          posNode === 'pos-4-2' ||
          pos === '4.2 หัวหน้างานกุหลาบ/งานทดลอง' || 
          pos === 'หัวหน้างานกุหลาบ/งานทดลอง' || 
          pos.includes('หัวหน้างานกุหลาบ/งานทดลอง') ||
          (pos.includes('หัวหน้างานกุหลาบ') && !pos.includes('2.2')) ||
          (deptNode === 'division-2' && pos.includes('หัวหน้า') && !posNode.startsWith('pos-5-')) ||
          ((dept.includes('กุหลาบ') || dept.includes('ทดลอง')) && (dept.includes('2.') || dept.includes('2 ') || dept === 'งานกุหลาบ / งานทดลอง') && pos.includes('หัวหน้า') && !pos.includes('2.1') && !pos.includes('2.2') && !posNode.startsWith('pos-5-'))
        );
      }) || null;
      if (headRoseExp) markPlaced(headRoseExp);

      const headRattanabuppha = list.find(e => {
        if (isUnassigned(e)) return false;
        const eid = String(e.id || e.code);
        if (placedEmployeeIds.has(eid)) return false;
        const pos = e.position || '';
        const dept = e.department || '';
        const posNode = e.positionNodeId || '';
        const deptNode = e.departmentNodeId || '';
        return (
          posNode === 'pos-4-3' ||
          pos === '4.3 หัวหน้างานรัตนบุปผา' || 
          pos === 'หัวหน้างานรัตนบุปผา' || 
          pos.includes('หัวหน้างานรัตนบุปผา') ||
          (deptNode === 'division-3' && pos.includes('หัวหน้า') && !posNode.startsWith('pos-5-')) ||
          (dept.includes('รัตนบุปผา') && (dept.includes('3.') || dept.includes('3 ') || dept === 'งานรัตนบุปผา') && pos.includes('หัวหน้า') && !pos.includes('3.1') && !pos.includes('3.2') && !pos.includes('3.3') && !pos.includes('3.4') && !posNode.startsWith('pos-5-'))
        );
      }) || null;
      if (headRattanabuppha) markPlaced(headRattanabuppha);

      const headDhammayatra = list.find(e => {
        if (isUnassigned(e)) return false;
        const eid = String(e.id || e.code);
        if (placedEmployeeIds.has(eid)) return false;
        const pos = e.position || '';
        const dept = e.department || '';
        const posNode = e.positionNodeId || '';
        const deptNode = e.departmentNodeId || '';
        return (
          posNode === 'pos-4-4' ||
          pos === '4.4 หัวหน้างานธรรมยาตรา' || 
          pos === 'หัวหน้างานธรรมยาตรา' || 
          pos.includes('หัวหน้างานธรรมยาตรา') ||
          (deptNode === 'division-4' && pos.includes('หัวหน้า') && !posNode.startsWith('pos-5-')) ||
          (dept.includes('ธรรมยาตรา') && (dept.includes('4.') || dept.includes('4 ') || dept === 'งานธรรมยาตรา') && pos.includes('หัวหน้า') && !pos.includes('4.1') && !pos.includes('4.2') && !pos.includes('4.3') && !posNode.startsWith('pos-5-'))
        );
      }) || null;
      if (headDhammayatra) markPlaced(headDhammayatra);`;

const newPillarsBlock = `      // Section Heads for 4 Main Pillars (หัวหน้าส่วนงานทั้ง 4 - รองรับทั้งตำแหน่งหลัก และ ตำแหน่งควบ/รักษาการ)
      function findPillarHead(divisionId, posNodeId, posLabels, deptKeywords) {
        // 1. ตรวจสอบตำแหน่งหลัก (ต้องยังไม่ถูกวาดที่อื่น)
        const primaryMatch = list.find(e => {
          if (isUnassigned(e)) return false;
          const eid = String(e.id || e.code);
          if (placedEmployeeIds.has(eid)) return false;
          const p = e.position || '';
          const d = e.department || '';
          const pn = e.positionNodeId || '';
          const dn = e.departmentNodeId || '';
          if (pn && pn === posNodeId) return true;
          if (posLabels.some(l => p === l || p.includes(l))) return true;
          if (dn === divisionId && p.includes('หัวหน้า') && !pn.startsWith('pos-5-')) return true;
          if (deptKeywords.some(k => d.includes(k)) && p.includes('หัวหน้า') && !p.includes('1.1') && !p.includes('1.2') && !p.includes('1.3') && !p.includes('1.4') && !pn.startsWith('pos-5-')) return true;
          return false;
        });
        if (primaryMatch) {
          markPlaced(primaryMatch);
          return primaryMatch;
        }

        // 2. ตรวจสอบตำแหน่งควบ / รักษาการ (อนุญาตให้แสดงได้แม้จะมีตำแหน่งหลักอยู่ที่อื่น)
        const concurrentMatch = (window.employees || list || []).find(e => {
          if (!e) return false;
          const concList = Array.isArray(e.concurrentPositions) ? e.concurrentPositions : [];
          if (concList.length === 0) return false;
          return concList.some(c => {
            if (!c) return false;
            if (c.positionNodeId && c.positionNodeId === posNodeId) return true;
            if (c.departmentNodeId && c.departmentNodeId === divisionId) return true;
            const cp = String(c.position || '').trim();
            const cd = String(c.department || '').trim();
            if (posLabels.some(l => cp === l || cp.includes(l))) return true;
            if (deptKeywords.some(k => cd.includes(k)) && cp.includes('หัวหน้า')) return true;
            return false;
          });
        });

        if (concurrentMatch) {
          return { ...concurrentMatch, isConcurrentInThisHead: true };
        }
        return null;
      }

      const headCentral = findPillarHead('division-1', 'pos-4-1', ['4.1 หัวหน้างานส่วนกลาง', 'หัวหน้างานส่วนกลาง'], ['ส่วนกลาง']);
      const headRoseExp = findPillarHead('division-2', 'pos-4-2', ['4.2 หัวหน้างานกุหลาบ/งานทดลอง', 'หัวหน้างานกุหลาบ/งานทดลอง', 'หัวหน้างานกุหลาบ'], ['กุหลาบ', 'ทดลอง']);
      const headRattanabuppha = findPillarHead('division-3', 'pos-4-3', ['4.3 หัวหน้างานรัตนบุปผา', 'หัวหน้างานรัตนบุปผา'], ['รัตนบุปผา']);
      const headDhammayatra = findPillarHead('division-4', 'pos-4-4', ['4.4 หัวหน้างานธรรมยาตรา', 'หัวหน้างานธรรมยาตรา'], ['ธรรมยาตรา']);`;

if (!html.includes(oldPillarsBlock)) {
  console.error("oldPillarsBlock not found");
  process.exit(1);
}
html = html.replace(oldPillarsBlock, newPillarsBlock);
console.log("1. Replaced 4 Main Pillars section head matching with concurrent position support");

// Also add visual badge and data attributes to head box
const oldHeadAvatar = `            <div class="head-avatar avatar-bg-\${col.theme}" 
                 \${col.headEmp ? \`draggable="true" ondragstart="handleAvatarDragStart(event, '\${escapeHtml(col.headEmp.id || col.headEmp.code)}')"\` : ''}>
              \${col.headEmp && (col.headEmp.photoUrl || col.headEmp.photo) ? \`<img src="\${col.headEmp.photoUrl || col.headEmp.photo}" alt="\${escapeHtml(col.headEmp.name)}">\` : \`<i class="bi bi-person-badge-fill"></i>\`}
            </div>`;

const newHeadAvatar = `            <div class="head-avatar avatar-bg-\${col.theme} position-relative" 
                 \${col.headEmp ? \`draggable="true" ondragstart="handleAvatarDragStart(event, '\${escapeHtml(col.headEmp.id || col.headEmp.code)}')"\` : ''}>
              \${col.headEmp && (col.headEmp.photoUrl || col.headEmp.photo) ? \`<img src="\${col.headEmp.photoUrl || col.headEmp.photo}" alt="\${escapeHtml(col.headEmp.name)}">\` : \`<i class="bi bi-person-badge-fill"></i>\`}
              \${col.headEmp && col.headEmp.isConcurrentInThisHead ? \`<span class="position-absolute top-0 end-0 badge bg-warning text-dark border border-white p-0.5 rounded-circle" style="font-size: 7px; transform: translate(25%, -25%);" title="รักษาการ / ดำรงตำแหน่งควบ"><i class="bi bi-star-fill"></i></span>\` : ''}
            </div>`;

if (!html.includes(oldHeadAvatar)) {
  console.error("oldHeadAvatar not found");
  process.exit(1);
}
html = html.replace(oldHeadAvatar, newHeadAvatar);
console.log("2. Added star badge to head avatar when concurrent");

fs.writeFileSync('org_chart.html', html, 'utf8');
console.log("Successfully patched pillar heads with concurrent support!");
