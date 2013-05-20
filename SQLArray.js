
/*  SQL Engine For JavaScript Array Query   */
/*  Inspired From JsonSQL & SQLike  */
/*  2013/05/20  */

var JSQL = {
    sql: null,
    run: function(sql,suc,fail){
        this.sql = sql;
        try{
            var ds = this.parse(sql);
            if(suc)
                suc(ds);
        } catch (e){
            if(fail) fail();
        }
    },
    parse: function(sql){
        var sps = this.specialsSQLs;
        for(var i=0;i<sps.length;i++){
            var si = sps[i];
            if($.trim(sql.toLowerCase()) == $.trim(si.getSQL().toLowerCase())){
                return si.fn();
            }
        }

        sql = sql.replace(/[\f\n\r\t\v]/ig,'');// SQL 语句有回车换行的情况
        var testSQL = sql.toLowerCase();

        // 创建表
        if(testSQL.indexOf('create table if not exists')!=-1){
            var tableName = sql.substring(27,sql.indexOf(' ',27));
            this.create(tableName);
            return;
        }

        // 添加
        if(testSQL.indexOf('insert')!=-1){
            var res = sql.match(/^insert\s+into\s+(.+)\s*\((.+)\)\s+values\s+\((.+)\)\s*$/i);
            var me = this;
            var ops = {
                table: $.trim(res[1]),
                values: (function(){
                    var cs = res[2];//列
                    var vs = res[3];//值
                    cs = cs.split(',');
                    // '123','0','test'
                    vs = $.trim(vs);
                    if(vs.indexOf("'")!=-1 && vs.lastIndexOf("'") == $.trim(vs).length-1){
                        vs = vs.substring(1,$.trim(vs).length-1);
                        vs = vs.split("','");
                    } else {
                        vs = vs.split(',');                        
                    }
                    
                    if(!cs.length || !vs.length || cs.length!=vs.length){
                        debugLog('SQL 出错:' + sql,'error')
                        return;
                    }
                    var re = {};
                    for(var i=0;i<cs.length;i++){
                        re[$.trim(cs[i])] = $.trim(vs[i]);
                    }
                    return re;
                })()
            };
            this.add(ops);
            return;
        }

        // 更新
        if(testSQL.indexOf('update')!=-1){
            var res = sql.match(/^update\s*([a-z0-9_]+)\s*set\s*(.+)\s*where\s*(.+)\s*$/i);
            var me = this;
            var ops = {
                table: $.trim(res[1]),
                set: (function(){
                        var re = "";
                        var sets = res[2];
                        sets = sets.split("',");//按单撇号逗号分割
                        for(var i=0;i<sets.length;i++){
                            var si = sets[i];
                            si = $.trim(si);
                            si = si.split('=');
                            re += 'this.' + $.trim(si[0]) + '=' + $.trim(si[1]);
                            if(i < sets.length-1)
                                re += "'";//这里要补上单撇号
                            re +=";";
                        }
                        return re;
                    })(),
                where: this.getWhere(res[3])
            };
            this.update(ops);
            return;
        }

        // 删除
        if(testSQL.indexOf('delete from')!=-1){
            var res = sql.match(/^delete\s+from\s+(.+)\s+where\s+(.+)\s*$/i);
            var me = this;
            var ops = {
                table: $.trim(res[1]),
                where: this.getWhere(res[2])
            };
            this.del(ops);
            return;            
        }

        // 查询
        if(testSQL.indexOf('select')!=-1){

            var getCount = false;
            if(testSQL.indexOf('count(0)')!=-1){
                sql = sql.replace(/count\(0\)/i,'*');
                getCount = true;
            }

            var res;
            if(testSQL.indexOf('where')!=-1){
                // where 和 order by,limit 组合的情况
                if(testSQL.indexOf('order by')!=-1){
                    sql = sql.replace(/where/i,'where(');
                    sql = sql.replace(/order by/i,')order by');
                    res = sql.match(/^(select)\s+([a-z0-9_\,\.\s\*]+)\s+from\s+([a-z0-9_,\.]+)(?: where\s*\((.+)\))?\s*(?:order\sby\s+([a-z0-9_\,]+))?\s*(asc|desc)?\s*(?:limit\s+([0-9_\,]+))?/i);
                } else if(testSQL.indexOf('limit')!=-1){
                    sql = sql.replace(/where/i,'where(');
                    sql = sql.replace(/limit/i,')limit');
                    res = sql.match(/^(select)\s+([a-z0-9_\,\.\s\*]+)\s+from\s+([a-z0-9_,\.]+)(?: where\s*\((.+)\))?\s*(?:order\sby\s+([a-z0-9_\,]+))?\s*(asc|desc)?\s*(?:limit\s+([0-9_\,]+))?/i);
                } else {
                    res = sql.match(/^(select)\s+([a-z0-9_\,\.\s\*]+)\s+from\s+([a-z0-9_,\.]+)(?: where\s+(.+))?\s*(?:order\sby\s+([a-z0-9_\,]+))?\s*(asc|desc)?\s*(?:limit\s+([0-9_\,]+))?/i);                    
                }
            } else {
                res = sql.match(/^(select)\s+([a-z0-9_\,\.\s\*]+)\s+from\s+([a-z0-9_,\.]+)(?: where\s+(.+))?\s*(?:order\sby\s+([a-z0-9_\,]+))?\s*(asc|desc)?\s*(?:limit\s+([0-9_\,]+))?/i);
            }
            var me = this;
            var ops = {
                fields: res[2] && res[2].replace(' ','').split(','), 
                from: res[3] && res[3].replace(' ',''), 
                where: this.getWhere(res[4]),
                orderby: (res[5] == undefined)? []:res[5].replace(' ','').split(','),
                order: (res[6] == undefined)? "asc":res[6],
                limit: (res[7] == undefined)? []:res[7].replace(' ','').split(',')
            };

            var rs = this.select(ops) || [];
            if(getCount)
                return rs.length;
            return JSON.stringify(rs);            
        }

        debugLog('还不支持的 SQL 语句' + sql,'error');
       
    },
    create: function(tableName){
        tableName = $.trim(tableName);
        ZD.LocalData[tableName] = new ZD.LocalData.Factory(tableName);
        return ZD.LocalData[tableName];
    },
    add: function(ops){
        if(!ops.table || !ops.values){
            debugLog('inser into 语句解析错误' + this.sql,'error');            
        }

        var ds = [];
        var data_entity = ZD.LocalData[ops.table];
        if(data_entity)
            ds = data_entity.getData();
        else {
            // 如果没有则创建一个数据实体
            data_entity = this.create(ops.table);
        }

        SQLike.q({
            InsertInto: ds,
            Values: ops.values
        });
        // 更新数据
        data_entity.setData(ds);
    },
    update: function(ops){
        if(!ops.table || !ops.set){
            debugLog('update 语句解析错误' + this.sql,'error');
        }
        var ds = [];
        var data_entity = ZD.LocalData[ops.table];
        if(data_entity)
            ds = data_entity.getData();
        else {
            // 如果没有则创建一个数据实体
            data_entity = this.create(ops.table);
        }

        eval("function doWhere(){ return "+ ops.where +" }");
        eval("function doSet(){ return "+ ops.set +"}");
        SQLike.q({
            Update: ds,
            Set: function(){
                return doSet.call(this);
            },
            Where: function(){
                return doWhere.call(this);
            }
        });

        // 更新数据
        data_entity.setData(ds);        
    },
    del: function(ops){
        if(!ops.table || !ops.where){
            debugLog('delete 语句解析错误' + this.sql,'error');
        }
        var ds = [];
        var data_entity = ZD.LocalData[ops.table];
        if(data_entity)
            ds = data_entity.getData();

        eval("function doWhere(){ return "+ ops.where +" }");
        SQLike.q({
            DeleteFrom: ds,
            Where:function(){
                return doWhere.call(this);
            }
        });
    },
    select: function(ops){
        var o = { fields:["*"], from:"", where:"", orderby:[], order: "asc", limit:[] };
        for(i in ops) o[i] = ops[i];

        var ds = [];
        var tables = o.from.split(',');
        if(tables.length > 1){
            // TODO 多表查询
            debugLog('多表查询错误' + sql,'error');
        } else {
            var data_entity = ZD.LocalData[$.trim(tables[0])];
            if(data_entity)
                ds = data_entity.getData();
        }

        var result = [];
        result = this.returnFilter(ds, o);
        result = this.returnOrderBy(result, o.orderby, o.order);
        result = this.returnLimit(result, o.limit);

        return result;
    },
    getWhere: function(where){
        var re;
        if(where == undefined){
            // 无条件
            re = true;
        } else {
            // 有条件
            re = where;
            // 替换为JS语法备用

            re = re.replace(/([^><])=/ig,"$1==");
            re = re.replace(/<>/ig,'!=');
            re = re.replace(/\s+and\s+/ig,' && ');
            re = re.replace(/\s+or\s+/ig,' || ');

            re = " " + re;

            var replaced = {};
            var vs = re.match(/(\w+)\s*(?==|!=|<|>)\s*/ig);
            if(vs){
                var len = vs.length;
                if(len > 0){
                    for(var i=0;i<len;i++){
                        var v = vs[i];
                        if(replaced[v])
                            continue;
                        var pattern = new RegExp("([\\s\\(])"+ v,"ig");
                        re = re.replace(pattern,"$1this."+v);
                        replaced[v] = true;
                    }
                }
            }

            // in 查询的处理
            re = this.inStatement(re);
        }
        return re;
    },
    inStatement: function(where){
        // example: 
        // userID==51365 && cardID in(555555,666666)
        // convert to:
        // userID==53156 && (cardID==555555 || cardID==666666)
        var i = where.indexOf(' in(');
        if(i!=-1){
            where = where.replace(/  /g,' ');
            var in_string = "(";
            var sub_string = $.trim(where.substring(0,i-1));
            var in_key = $.trim(where.substring(sub_string.lastIndexOf(' ')+1,i));
            var in_values = where.substring(i+4,where.indexOf(')',i));
            var value_ary = in_values.split(',');
            for(var i=0;i<value_ary.length;i++){
                in_string += "this." + in_key + "==" + value_ary[i];
                if(i < value_ary.length-1)
                    in_string += "||";
                else
                    in_string += ")";
            }
            where = where.substring(0,where.indexOf(in_key)) + in_string;
        }
        return where;
    },
    returnFilter: function(dataArry,ops){

        eval("function doWhere(){ return "+ ops.where +" }");        
        return SQLike.q({
               Select: ops.fields,
               From: dataArry,
               Where: function(){
                    return doWhere.call(this);
                }
           }
        );
    },
    returnOrderBy: function(result,orderby,order){
        if(orderby.length == 0) 
            return result;
        
        result.sort(function(a,b){
            switch(order.toLowerCase()){
                case "desc": return (eval('a.'+ orderby[0] +' < b.'+ orderby[0]))? 1:-1;
                case "asc":  return (eval('a.'+ orderby[0] +' > b.'+ orderby[0]))? 1:-1;
            }
        });

        return result;  
    },
    returnLimit: function(result,limit){
        switch(limit.length){
            case 0: return result;
            case 1: return result.splice(0,limit[0]);
            case 2: return result.splice(limit[0]-1,limit[1]);
        }
    }
};

// 输出控制台日志
function debugLog(msg,type){
    if(!type)
        type = "log";
    console[type](msg);
}