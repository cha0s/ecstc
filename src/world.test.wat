(module

  (memory $data (import "F" "data") 0)
  (memory $dirty (import "F" "dirty") 0)
  (import "F" "proxies" (table $proxies 0 externref))
  (import "F" "callback" (func $callback (param i32) (param externref)))

  (func (export "tick") (param $delta f32) (param $total f32)
    ;;
    (local $i i32)
    (local $instance externref)
    (local $length i32)
    ;;
    (local.set $i (i32.const 0))
    (local.set $length (table.size $proxies))
    ;; while (i < length)
    (loop
      (br_if 1 (i32.ge_u (local.get $i) (local.get $length)))
      ;;   data[i] += (total + i)
      (f32.store
        $data
        (i32.mul (local.get $i) (i32.const 4))
        (f32.add
          (f32.add (f32.load $data (i32.mul (local.get $i) (i32.const 4))) (local.get $delta))
          (f32.convert_i32_u (local.get $i))
        )
      )
      ;;   if (0 === (i & 1))
      (if
        (i32.eqz (i32.and (local.get $i) (i32.const 1)))
        (then
          ;; callback(0, proxies[i]):
          (call $callback (i32.const 0) (table.get $proxies (local.get $i)))
        )
      )
      ;;   i += 1;
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      ;;
      (br 0)
    )
  )
)