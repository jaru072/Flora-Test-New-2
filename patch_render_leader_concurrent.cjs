const fs = require('fs');

let html = fs.readFileSync('org_chart.html', 'utf8');

// Also allow concurrent positions to match as team leader:
const targetLeaderMatch = `        // Match leader specifically (must not be unassigned and not already placed elsewhere)
        const leader = list.find(e => {
          if (isUnassigned(e)) return false;
          const eid = String(e.id || e.code);
          if (placedEmployeeIds.has(eid)) return false;
          const pos = e.position || '';
          const dept = e.department || '';
          // 1. Authoritative positionNodeId match
          if (leaderNode && e.positionNodeId === leaderNode.id) return true;
          // 2. Exact match on leaderTitle within this department
          if (leaderTitle && pos === leaderTitle && (e.departmentNodeId === nodeId || dept === deptName || dept === title)) return true;
          // 3. Head title within this department
          if ((e.departmentNodeId === nodeId || dept === deptName || (dept && deptName && (dept.includes(deptName) || deptName.includes(dept)))) && 
              pos.includes('หัวหน้า') && !pos.startsWith('4.')) {
            return true;
          }
          // 4. Substring matching allowed ONLY for legacy seed departments without explicit departmentNodeId
          if (isLegacyKnownDept && !e.departmentNodeId) {
            if (leaderCode && pos.includes(leaderCode)) return true;
          }
          return false;
        }) || null;
        if (leader) markPlaced(leader);`;

const replacementLeaderMatch = `        // Match leader specifically (ตำแหน่งหลัก หรือ ตำแหน่งควบ/รักษาการหัวหน้าทีม)
        const leader = list.find(e => {
          if (isUnassigned(e)) return false;
          const eid = String(e.id || e.code);
          const pos = e.position || '';
          const dept = e.department || '';

          // 1. ตรวจสอบตำแหน่งหลัก (ถ้ายังไม่ได้ถูกวาดที่อื่น)
          if (!placedEmployeeIds.has(eid)) {
            if (leaderNode && e.positionNodeId === leaderNode.id) return true;
            if (leaderTitle && pos === leaderTitle && (e.departmentNodeId === nodeId || dept === deptName || dept === title)) return true;
            if ((e.departmentNodeId === nodeId || dept === deptName || (dept && deptName && (dept.includes(deptName) || deptName.includes(dept)))) && 
                pos.includes('หัวหน้า') && !pos.startsWith('4.')) {
              return true;
            }
            if (isLegacyKnownDept && !e.departmentNodeId && leaderCode && pos.includes(leaderCode)) return true;
          }

          // 2. ตรวจสอบตำแหน่งควบ/รักษาการ
          const concList = Array.isArray(e.concurrentPositions) ? e.concurrentPositions : [];
          const hasConcLeader = concList.some(c => {
            if (!c) return false;
            if (leaderNode && c.positionNodeId === leaderNode.id) return true;
            const cDept = String(c.department || '').trim();
            const targetD = String(deptName || title || '').trim();
            const deptMatches = (nodeId && c.departmentNodeId === nodeId) || (cDept && targetD && (cDept === targetD || cDept.includes(targetD) || targetD.includes(cDept)));
            if (deptMatches && (c.position === leaderTitle || (c.position && c.position.includes('หัวหน้า')))) return true;
            return false;
          });
          if (hasConcLeader) return true;

          return false;
        }) || null;
        if (leader && !Array.isArray(leader.concurrentPositions)?.some(c => c.department === deptName)) {
          markPlaced(leader);
        }`;

if (!html.includes(targetLeaderMatch)) {
  console.error("targetLeaderMatch not found");
  process.exit(1);
}
html = html.replace(targetLeaderMatch, replacementLeaderMatch);

fs.writeFileSync('org_chart.html', html, 'utf8');
console.log("Successfully patched leader matching with concurrent roles!");
